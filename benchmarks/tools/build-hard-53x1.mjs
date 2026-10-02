import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Shape, ShapeOperationConfig, stack } from '../../shapeOperations.js';
import {
    artifactInstancesHash, canonicalMultiset, compileCatalog, deriveMetadata,
    deriveStructuralFingerprint, instanceContentHash, parseParts, readJson,
    refinementBundleForTarget, replayWitness,
} from './benchmark-core.mjs';
import {
    GENERATION_FRAMEWORK_VERSION, OrdinaryAtomAllocator, WitnessBuilder,
    combineDisjoint, consolidateAvailableInputs, partitionIntoColumns,
    rotateColumnToQuadrant, selectColumn, stackLayers,
} from './generation-framework.mjs';
import { buildPinSubassembly, PIN_CONSTRUCTION_PLANNER_VERSION } from './pin-construction-planner.mjs';
import {
    buildCrystalSubassembly, CRYSTAL_CONSTRUCTION_PLANNER_VERSION,
} from './crystal-construction-planner.mjs';
import {
    buildMixedPinCrystalSubassembly, MIXED_PIN_CRYSTAL_PLANNER_VERSION,
} from './mixed-pin-crystal-construction-planner.mjs';
import {
    buildSolverEvaluationView, ENVIRONMENT_EXPANSION_GENERATOR_VERSION,
    expandWitnessEnvironment,
} from './environment-expansion.mjs';
import { ROOT, fileSha256, loadRepositoryPolicy } from './repository-policy.mjs';

export const HARD_53X1_RELEASE_ID = 'hard-53x1-stage-v1';
export const HARD_53X1_PARTITION = 'expansion-pilot';
const CORE_RELEASE_ID = 'hard-53x1-core-stage-v1';

export function previewDirectLayerComposition(target, maxLayers = 4) {
    const layerCodes = target.split(':');
    const config = new ShapeOperationConfig(maxLayers);
    let result = Shape.fromShapeCode(layerCodes[0]);
    for (const layerCode of layerCodes.slice(1)) {
        result = stack(result, Shape.fromShapeCode(layerCode), config)[0];
    }
    return result.toShapeCode();
}

function firstPart(code) {
    return parseParts(code).flat().find(part => part.shape !== '-');
}

function buildRefinementPools(builder, bundle) {
    const pools = new Map();
    for (const { shape, count } of bundle.inputs) {
        for (let occurrence = 0; occurrence < count; occurrence++) {
            const columns = partitionIntoColumns(builder, builder.input(shape));
            for (const id of columns) {
                const part = firstPart(builder.shape(id));
                const key = `${part.shape}${part.color}`;
                const ids = pools.get(key) ?? [];
                ids.push(id);
                pools.set(key, ids);
            }
        }
    }
    return pools;
}

function takeRefinementAtom(builder, pools, part, quadrant) {
    const key = `${part.shape}${part.color}`;
    const ids = pools.get(key) ?? [];
    if (!ids.length) throw new Error(`refinement occurrence exhausted for ${key}`);
    return rotateColumnToQuadrant(builder, ids.shift(), quadrant);
}

function buildDirectLayeredTarget(builder, targetCase, catalog, bundle) {
    const targetParts = parseParts(targetCase.target).flat();
    const hasPin = targetParts.some(part => part.shape === 'P');
    const hasCrystal = targetParts.some(part => part.shape === 'c');
    const allocator = new OrdinaryAtomAllocator(builder, catalog, {
        track: targetCase.track,
        refinementGroup: bundle.group,
    });
    const refinementPools = buildRefinementPools(builder, bundle);
    function buildPart(part, quadrant) {
        if (part.shape === 'P' || part.shape === 'c') throw new Error(`special part ${part.shape} requires a mechanical subassembly`);
        if (part.shape === 'X' || part.shape === 'Y') return takeRefinementAtom(builder, refinementPools, part, quadrant);
        return allocator.atom(part, quadrant);
    }
    function buildSolidLayer(layerCode) {
        const parts = parseParts(layerCode)[0];
        const ids = parts.map((part, quadrant) => part.shape === '-' ? null : buildPart(part, quadrant)).filter(id => id !== null);
        if (!ids.length) throw new Error('all-empty target layer is unsupported');
        const layerId = combineDisjoint(builder, ids);
        if (builder.shape(layerId) !== layerCode) throw new Error(`direct layer mismatch: ${builder.shape(layerId)} != ${layerCode}`);
        return layerId;
    }
    function buildSolidLayers(layerCodes) {
        const resultId = stackLayers(builder, layerCodes.map(buildSolidLayer));
        const expected = layerCodes.join(':');
        if (builder.shape(resultId) !== expected) throw new Error(`canonical gravity changed direct assembly: ${builder.shape(resultId)} != ${expected}`);
        return resultId;
    }

    const layerCodes = targetCase.target.split(':');
    if (hasPin && hasCrystal) {
        builder.priorConstructionAttempts = [{
            strategy: 'direct-layered-forward-construction',
            accepted: false,
            category: 'mixed-pin-crystal-gravity gap',
            reason: 'Pin and Crystal base planners do not define the required ordered mixed state transition',
        }];
        const sacrificialTypes = ['C', 'R', 'S', 'W'];
        let sacrificialIndex = 0;
        const buildSacrificialPart = quadrant => {
            for (let offset = 0; offset < sacrificialTypes.length; offset++) {
                const shape = sacrificialTypes[(sacrificialIndex + offset) % sacrificialTypes.length];
                try {
                    const id = allocator.atom({ shape, color: 'u' }, quadrant);
                    sacrificialIndex = (sacrificialIndex + offset + 1) % sacrificialTypes.length;
                    return id;
                } catch (error) {
                    if (!/no ordinary source available/.test(error.message)) throw error;
                }
            }
            throw new Error('no ordinary source available for mixed sacrificial support');
        };
        const { resultId, plan } = buildMixedPinCrystalSubassembly(builder, targetCase.target, {
            buildPart,
            buildSacrificialPart,
        });
        builder.constructionStrategy = `generic-${plan.kind}`;
        return resultId;
    }
    if (hasPin) {
        const pinIndex = layerCodes.findIndex((layerCode, index) => {
            if (index + 1 >= layerCodes.length) return false;
            const pinParts = parseParts(layerCode)[0];
            const upperBottom = parseParts(layerCodes[index + 1])[0];
            const isPinMask = pinParts.every(part => part.shape === '-' || part.shape === 'P');
            const maskMatches = pinParts.every((part, quadrant) => (part.shape === 'P') === (upperBottom[quadrant].shape !== '-'));
            const remainderIsSolid = [...layerCodes.slice(0, index), ...layerCodes.slice(index + 1)]
                .flatMap(code => parseParts(code)[0]).every(part => !['P', 'c'].includes(part.shape));
            return isPinMask && maskMatches && remainderIsSolid;
        });
        if (pinIndex < 0) {
            const sacrificialShape = targetParts.find(part => !['-', 'P', 'c', 'X', 'Y'].includes(part.shape))?.shape ?? 'C';
            const { resultId, plan } = buildPinSubassembly(builder, targetCase.target, {
                buildPart,
                buildSacrificialPart: quadrant => allocator.atom({ shape: sacrificialShape, color: 'u' }, quadrant),
            });
            builder.constructionStrategy = `generic-${plan.kind}`;
            return resultId;
        }
        let pinnedUpper = buildSolidLayers(layerCodes.slice(pinIndex + 1));
        pinnedUpper = builder.operate('Pin Pusher', [pinnedUpper])[0];
        const resultId = pinIndex === 0
            ? pinnedUpper
            : builder.operate('Stacker', [buildSolidLayers(layerCodes.slice(0, pinIndex)), pinnedUpper])[0];
        if (builder.shape(resultId) !== targetCase.target) throw new Error(`Pin subassembly result ${builder.shape(resultId)} != ${targetCase.target}`);
        return resultId;
    }
    if (hasCrystal) {
        const denseEligible = layerCodes.every(layerCode => {
            const parts = parseParts(layerCode)[0];
            const crystals = parts.filter(part => part.shape === 'c');
            return parts.every(part => part.shape !== '-')
                && (!crystals.length || (crystals.length < parts.length && new Set(crystals.map(part => part.color)).size === 1));
        });
        if (denseEligible) {
            const directPreview = previewDirectLayerComposition(targetCase.target, builder.config.maxShapeLayers);
            if (directPreview === targetCase.target) {
                const layerIds = layerCodes.map(layerCode => {
                    const parts = parseParts(layerCode)[0];
                    const crystals = parts.filter(part => part.shape === 'c');
                    if (!crystals.length) return buildSolidLayer(layerCode);
                    const scaffoldCode = parts.map(part => part.shape === 'c' ? '--' : `${part.shape}${part.color}`).join('');
                    let id = buildSolidLayer(scaffoldCode);
                    id = builder.operate('Crystal Generator', [id], { color: crystals[0].color })[0];
                    if (builder.shape(id) !== layerCode) throw new Error(`dense Crystal layer ${builder.shape(id)} != ${layerCode}`);
                    return id;
                });
                const resultId = stackLayers(builder, layerIds);
                if (builder.shape(resultId) !== targetCase.target) throw new Error(`dense Crystal assembly ${builder.shape(resultId)} != ${targetCase.target}`);
                return resultId;
            }
            builder.priorConstructionAttempts = [{
                strategy: 'direct-layered-forward-construction',
                accepted: false,
                category: 'construction planner gap',
                reason: `dense Crystal assembly ${directPreview} != ${targetCase.target}`,
            }];
        }
        const sacrificialShape = targetParts.find(part => !['-', 'P', 'c', 'X', 'Y'].includes(part.shape))?.shape ?? 'C';
        const priorAttempts = builder.priorConstructionAttempts ?? [];
        const { resultId, plan } = buildCrystalSubassembly(builder, targetCase.target, {
            buildPart,
            buildSacrificialPart: quadrant => allocator.atom({ shape: sacrificialShape, color: 'u' }, quadrant),
        });
        builder.priorConstructionAttempts = [
            ...priorAttempts,
            ...(builder.priorConstructionAttempts ?? []).filter(attempt => !priorAttempts.includes(attempt)),
        ];
        builder.constructionStrategy = `generic-crystal-${plan.kind}`;
        return resultId;
    }
    return buildSolidLayers(layerCodes);
}

function failureCategory(error) {
    const message = error.message ?? String(error);
    if (/mixed Pin\/Crystal/i.test(message)) return 'mixed-pin-crystal-gravity gap';
    if (/Pin target|Pin construction/i.test(message)) return 'Pin construction unsupported';
    if (/Crystal target|Crystal construction/i.test(message)) return 'Crystal construction unsupported';
    if (/refinement occurrence|no ordinary source|multiplicity|input/i.test(message)) return 'resource selection failure';
    if (/gravity changed|layer mismatch|result .* !=/i.test(message)) return 'construction planner gap';
    if (/Crystal assembly/i.test(message)) return 'construction planner gap';
    if (/replay/i.test(message)) return 'replay semantic failure';
    return 'unknown';
}

function mechanicsFor(instance) {
    const operations = new Set(instance.witness.steps.map(step => step.operation));
    const result = [];
    for (const [operation, label] of [
        ['Cutter', 'Cut'], ['Stacker', 'Stack'], ['Swapper', 'Swapper'],
        ['Pin Pusher', 'Pin'], ['Crystal Generator', 'Crystal'], ['Painter', 'Paint'],
    ]) if (operations.has(operation)) result.push(label);
    return result;
}

function coreInstanceFromBuilder(targetCase, builder, resultId, bundle) {
    const inputs = consolidateAvailableInputs(builder.initial, bundle.inputs);
    const instance = {
        schemaVersion: 2,
        id: `${targetCase.id}-core-01`,
        suite: 'hard',
        track: targetCase.track,
        targetId: targetCase.id,
        target: targetCase.target,
        partition: HARD_53X1_PARTITION,
        inputs,
        rules: { maxLayers: 4, cleanPainting: true, allowSplitting: false },
        provenance: {},
        construction: { strategy: builder.constructionStrategy ?? 'direct-layered-forward-construction' },
        witness: builder.witness(resultId),
    };
    const replay = replayWitness(instance, globalThis.__hard53Catalog);
    if (!replay.valid) throw new Error(`core forward replay failed: ${replay.phase}: ${replay.errors.join('; ')}`);
    instance.difficulty = deriveMetadata(instance, replay);
    const structural = deriveStructuralFingerprint(instance, replay);
    instance.diversity = {
        inputMultisetSignature: canonicalMultiset(inputs),
        structureVersion: structural.version,
        structureSignature: structural.signature,
        classification: 'representative',
        duplicateOf: null,
        maxPriorWeightedJaccard: 0,
    };
    instance.instanceSha256 = instanceContentHash(instance);
    return instance;
}

function selectAdditions(core, targetCase, catalog, bundle) {
    const counts = new Map(core.witness.initial.map(token => [token.shape, 0]));
    for (const token of core.witness.initial) counts.set(token.shape, (counts.get(token.shape) ?? 0) + 1);
    const additions = [];
    for (const required of bundle.inputs) {
        const missing = required.count - (counts.get(required.shape) ?? 0);
        if (missing > 0) additions.push({ shape: required.shape, count: missing });
    }
    const vocabulary = new Set(parseParts(targetCase.target).flat().map(part => part.shape).filter(shape => !['-', 'P', 'c', 'X', 'Y'].includes(shape)));
    if (!vocabulary.size) {
        for (const token of core.witness.initial) {
            for (const part of parseParts(token.shape).flat()) if (!['-', 'P', 'c', 'X', 'Y'].includes(part.shape)) vocabulary.add(part.shape);
        }
    }
    const ordinary = Object.entries(catalog.ordinary)
        .filter(([category]) => !category.includes('excluded') && category !== 'pure')
        .flatMap(([, shapes]) => shapes)
        .filter(shape => shape !== 'SuSuRuRu' || (targetCase.track === 'side' && !bundle.group))
        .filter(shape => parseParts(shape)[0].some(part => vocabulary.has(part.shape)))
        .sort();
    const desired = 1 + (Number(targetCase.id.slice(-3)) % 3);
    let addedOrdinary = 0;
    for (const shape of ordinary) {
        if (addedOrdinary >= desired) break;
        const existing = counts.get(shape) ?? 0;
        const alreadyAdded = additions.find(row => row.shape === shape)?.count ?? 0;
        if (existing + alreadyAdded >= 3 || shape === targetCase.target) continue;
        additions.push({ shape, count: 1 });
        addedOrdinary += 1;
    }
    if (!addedOrdinary) throw new Error('expansion failure: no related ordinary catalog addition satisfies input rules');
    return additions.sort((a, b) => a.shape.localeCompare(b.shape));
}

async function instanceProvenance(repositoryPolicy, targetCase) {
    return {
        releaseId: HARD_53X1_RELEASE_ID,
        generatorVersion: `${GENERATION_FRAMEWORK_VERSION}+${PIN_CONSTRUCTION_PLANNER_VERSION}+${CRYSTAL_CONSTRUCTION_PLANNER_VERSION}+${MIXED_PIN_CRYSTAL_PLANNER_VERSION}+${ENVIRONMENT_EXPANSION_GENERATOR_VERSION}+hard-53x1-stage-v1`,
        generatorSourceSha256: await fileSha256('benchmarks/tools/build-hard-53x1.mjs'),
        targetSha256: targetCase.sha256,
        officialTargetsSha256: repositoryPolicy.officialTargets.manifest.sha256,
        catalogVersion: repositoryPolicy.catalog.version,
        catalogSha256: repositoryPolicy.catalog.sha256,
        inputSeedIdentity: repositoryPolicy.inputSeed.identity,
        inputSeedSha256: repositoryPolicy.inputSeed.sha256,
        gameSemanticsId: repositoryPolicy.gameSemantics.id,
        gameSemanticsSha256: repositoryPolicy.gameSemantics.sha256,
    };
}

function cloneCoreForStage(source, targetCase) {
    const core = structuredClone(source);
    core.id = `${targetCase.id}-core-01`;
    core.partition = HARD_53X1_PARTITION;
    core.provenance = {};
    core.construction = { strategy: `reuse-validated-${source.construction.strategy}` };
    core.instanceSha256 = instanceContentHash(core);
    return core;
}

export async function buildHard53x1({ write = true } = {}) {
    const [catalog, manifest, repositoryPolicy, expansionPolicy, coverage, pilot] = await Promise.all([
        readJson(path.join(ROOT, 'benchmarks/input_catalog.json')),
        readJson(path.join(ROOT, 'benchmarks/manifest.json')),
        loadRepositoryPolicy(),
        readJson(path.join(ROOT, 'benchmarks/policy/input-environment-expansion.v1.json')),
        readJson(path.join(ROOT, 'benchmarks/coverage-pilot/v1/instances.json')),
        readJson(path.join(ROOT, 'benchmarks/pilot/v2/instances.json')),
    ]);
    globalThis.__hard53Catalog = catalog;
    const compiled = compileCatalog(catalog);
    const policySha256 = await fileSha256('benchmarks/policy/input-environment-expansion.v1.json');
    const targets = manifest.cases.filter(item => item.suite === 'hard');
    const reusable = new Map();
    for (const instance of coverage.instances) reusable.set(instance.targetId, instance);
    reusable.set('hard-side-035', pilot.instances.find(instance => instance.targetId === 'hard-side-035'));
    const coreInstances = [];
    const instances = [];
    const attempts = [];
    const status = [];

    for (const targetCase of targets) {
        let core = null;
        let strategy = 'direct-layered-forward-construction';
        let rejectionCount = 0;
        const targetAttempts = [];
        try {
            if (reusable.has(targetCase.id)) {
                core = cloneCoreForStage(reusable.get(targetCase.id), targetCase);
                strategy = core.construction.strategy;
                targetAttempts.push({ strategy, accepted: true, source: reusable.get(targetCase.id).id });
            } else {
                const builder = new WitnessBuilder(4);
                const bundle = refinementBundleForTarget(targetCase.target, compiled);
                const resultId = buildDirectLayeredTarget(builder, targetCase, catalog, bundle);
                core = coreInstanceFromBuilder(targetCase, builder, resultId, bundle);
                strategy = core.construction.strategy;
                if (builder.priorConstructionAttempts?.length) {
                    targetAttempts.push(...builder.priorConstructionAttempts);
                    rejectionCount += builder.priorConstructionAttempts.filter(attempt => !attempt.accepted).length;
                }
                targetAttempts.push({ strategy, accepted: true });
            }
            const bundle = refinementBundleForTarget(targetCase.target, compiled);
            const additions = selectAdditions(core, targetCase, catalog, bundle);
            const plan = {
                id: `${targetCase.id}-additive-related-v1`,
                instanceId: `${targetCase.id}-53x1-01`,
                targetId: targetCase.id,
                partition: HARD_53X1_PARTITION,
                kind: 'additive',
                additions,
            };
            const { instance, replay } = expandWitnessEnvironment(core, plan, { catalog, policy: expansionPolicy, policySha256 });
            instance.expansion.sourceInstance = {
                releaseId: CORE_RELEASE_ID,
                id: core.id,
                instanceSha256: core.instanceSha256,
            };
            instance.provenance = await instanceProvenance(repositoryPolicy, targetCase);
            instance.difficulty = deriveMetadata(instance, replay);
            const structural = deriveStructuralFingerprint(instance, replay);
            instance.diversity = {
                inputMultisetSignature: canonicalMultiset(instance.availableInputs),
                structureVersion: structural.version,
                structureSignature: structural.signature,
                classification: 'representative',
                duplicateOf: null,
                maxPriorWeightedJaccard: 0,
            };
            instance.instanceSha256 = instanceContentHash(instance);
            coreInstances.push(core);
            instances.push(instance);
            targetAttempts.push({
                strategy: 'additive related-input expansion',
                accepted: true,
                expansionKind: instance.expansion.kind,
                availableInputCount: instance.difficulty.inputMultiplicity,
                coreBasisCount: instance.difficulty.coreInputMultiplicity,
            });
            attempts.push(...targetAttempts.map((attempt, index) => ({ targetId: targetCase.id, attempt: index + 1, ...attempt })));
            status.push({
                targetId: targetCase.id,
                track: targetCase.track,
                refinementGroup: bundle.group,
                generationAttempted: true,
                generated: true,
                forwardReplayPassed: true,
                expansionType: instance.expansion.kind,
                availableInputCount: instance.difficulty.inputMultiplicity,
                coreBasisCount: instance.difficulty.coreInputMultiplicity,
                majorMechanics: mechanicsFor(instance),
                structuralSignature: instance.diversity.structureSignature,
                difficulty: instance.difficulty,
                rejectionCount,
                failureReason: null,
                unsupportedCapability: null,
            });
        } catch (error) {
            rejectionCount += 1;
            const category = failureCategory(error);
            targetAttempts.push({ strategy, accepted: false, category, reason: error.message });
            attempts.push(...targetAttempts.map((attempt, index) => ({ targetId: targetCase.id, attempt: index + 1, ...attempt })));
            status.push({
                targetId: targetCase.id,
                track: targetCase.track,
                refinementGroup: (() => { try { return refinementBundleForTarget(targetCase.target, compiled).group; } catch { return null; } })(),
                generationAttempted: true,
                generated: false,
                forwardReplayPassed: false,
                expansionType: null,
                availableInputCount: null,
                coreBasisCount: null,
                majorMechanics: [],
                structuralSignature: null,
                difficulty: null,
                rejectionCount,
                failureReason: category,
                failureDetail: error.message,
                unsupportedCapability: category.includes('gap') || category.includes('unsupported') ? category : null,
            });
        }
    }

    const targetIds = instances.map(instance => instance.targetId);
    const artifact = {
        schemaVersion: 3,
        benchmarkInstanceSchemaVersion: 3,
        name: HARD_53X1_RELEASE_ID,
        releaseId: HARD_53X1_RELEASE_ID,
        suite: 'hard',
        partition: HARD_53X1_PARTITION,
        targetIds,
        candidateCount: instances.length + attempts.filter(attempt => attempt.accepted === false).length,
        acceptedCount: instances.length,
        rejectedCount: attempts.filter(attempt => attempt.accepted === false).length,
        instances,
    };
    artifact.sha256 = artifactInstancesHash(instances);
    const coreArtifact = {
        schemaVersion: 2,
        benchmarkInstanceSchemaVersion: 2,
        name: CORE_RELEASE_ID,
        releaseId: CORE_RELEASE_ID,
        suite: 'hard',
        partition: HARD_53X1_PARTITION,
        targetIds,
        candidateCount: coreInstances.length,
        acceptedCount: coreInstances.length,
        rejectedCount: 0,
        instances: coreInstances,
    };
    coreArtifact.sha256 = artifactInstancesHash(coreInstances);
    const solverView = buildSolverEvaluationView(artifact);
    solverView.sha256 = artifactInstancesHash(solverView.instances);
    const result = { artifact, coreArtifact, solverView, attempts, status };
    if (write) {
        const directory = path.join(ROOT, 'benchmarks/hard-53x1/v1');
        await mkdir(directory, { recursive: true });
        await writeFile(path.join(directory, 'core-instances.json'), `${JSON.stringify(coreArtifact, null, 2)}\n`);
        await writeFile(path.join(directory, 'instances.json'), `${JSON.stringify(artifact, null, 2)}\n`);
        await writeFile(path.join(directory, 'solver-inputs.json'), `${JSON.stringify(solverView, null, 2)}\n`);
        await writeFile(path.join(directory, 'generation-log.json'), `${JSON.stringify(attempts, null, 2)}\n`);
        await writeFile(path.join(directory, 'target-status.json'), `${JSON.stringify(status, null, 2)}\n`);
    }
    return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const result = await buildHard53x1();
    console.log(`Hard 53x1 stage: ${result.artifact.acceptedCount}/53 constructed; ${result.status.filter(item => !item.generated).length} failed`);
}
