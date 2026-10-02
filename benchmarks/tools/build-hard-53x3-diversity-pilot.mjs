import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
    Shape, ShapeOperationConfig, cut, halfCut, rotate90CW, rotate90CCW, rotate180,
} from '../../shapeOperations.js';
import {
    artifactContentHash, artifactInstancesHash, canonicalJson, canonicalMultiset,
    compileCatalog, deriveMetadata, deriveStructuralFingerprint, instanceContentHash,
    multisetDelta, multisetRows, parseParts, readJson, refinementBundleForTarget,
    replayWitness, sha256, validateExpansionMetadata, weightedJaccard,
} from './benchmark-core.mjs';
import { buildSolverEvaluationView, expandWitnessEnvironment } from './environment-expansion.mjs';
import { WitnessBuilder } from './generation-framework.mjs';
import { fileSha256, loadRepositoryPolicy, ROOT } from './repository-policy.mjs';

export const DIVERSITY_PILOT_RELEASE_ID = 'hard-53x3-diversity-pilot-v1';
export const DIVERSITY_PILOT_MANIFEST_REVISION_ID = `${DIVERSITY_PILOT_RELEASE_ID}-manifest-r1`;
export const DIVERSITY_PILOT_VERSION = 'hard-53x3-diversity-pilot-v1-transformative-source-ancestry';
export const BASELINE_RELEASE_ID = 'hard-53x1-stage-v1';
export const BASELINE_MANIFEST_REVISION_ID = 'hard-53x1-stage-v1-manifest-r2';
export const DIVERSITY_PILOT_PARTITION = 'expansion-pilot';

const BASELINE_ARTIFACT_CANONICAL_SHA256 = '11005e04e359fff9d0d3a0fec66dd491ca8e441f5c5c880e1ff3441b9fc77da3';
const BASELINE_INSTANCES_SHA256 = '40c4ea586dfeafb5f5e37545101220451d2cc9a9ca2ab54eb9d00a94806c8375';
const BASELINE_SOLVER_PROJECTION_SHA256 = '52b07a352c8da0215bd4e052c08262b2255aa094d1cddd9635a75f5ea68bf15a';

export const DIVERSITY_PILOT_TARGET_IDS = Object.freeze([
    'hard-main-001', // simple ordinary
    'hard-side-003', // small ordinary, baseline delta +1
    'hard-side-035', // refinement A
    'hard-main-010', // refinement B + Crystal
    'hard-side-040', // refinement C + sparse-upper Crystal outlier
    'hard-main-012', // refinement D + Mixed Pin/Crystal
    'hard-main-005', // generic Pin / overflow
    'hard-main-008', // staged Crystal mask
    'hard-main-007', // high-operation Mixed outlier
    'hard-side-036', // isolated-Pin outlier, environment ratio near 1
    'hard-side-033', // dense-Crystal fallback
    'hard-side-041', // refinement D, largest baseline expansion delta
    'hard-side-021', // shared-occurrence Pin construction
]);

const CONFIG = new ShapeOperationConfig(4);
const UNARY_OPERATIONS = Object.freeze([
    ['Cutter', shape => cut(shape, CONFIG)],
    ['Half Destroyer', shape => halfCut(shape, CONFIG)],
    ['Rotator CW', shape => rotate90CW(shape, CONFIG)],
    ['Rotator CCW', shape => rotate90CCW(shape, CONFIG)],
    ['Rotator 180', shape => rotate180(shape, CONFIG)],
]);

function sumRows(rows) {
    return (rows ?? []).reduce((sum, row) => sum + row.count, 0);
}

function canonicalRows(counts) {
    return [...counts].filter(([, count]) => count > 0)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([shape, count]) => ({ shape, count }));
}

function takePoolToken(builder, pool, shape, context) {
    const index = pool.findIndex(id => builder.shape(id) === shape);
    if (index < 0) throw new Error(`${context}: preprocessing pool does not contain ${shape}`);
    return pool.splice(index, 1)[0];
}

function appendFrozenWitness(builder, witness, initialMapping) {
    const tokenMapping = new Map(initialMapping);
    for (const [stepIndex, step] of witness.steps.entries()) {
        const inputs = step.inputs.map(id => {
            if (!tokenMapping.has(id)) throw new Error(`core step ${stepIndex}: missing mapped token ${id}`);
            return tokenMapping.get(id);
        });
        const produced = builder.operate(step.operation, inputs, step.params);
        const unmatched = [...produced];
        for (const declared of step.outputs) {
            const index = unmatched.findIndex(id => builder.shape(id) === declared.shape);
            if (index < 0) throw new Error(`core step ${stepIndex}: regenerated outputs do not contain ${declared.shape}`);
            tokenMapping.set(declared.id, unmatched.splice(index, 1)[0]);
        }
        if (unmatched.length) throw new Error(`core step ${stepIndex}: regenerated outputs were not fully mapped`);
    }
    const resultId = tokenMapping.get(witness.resultId);
    if (resultId === undefined) throw new Error('core result token was not mapped');
    return resultId;
}

function expandGraphWitnessEnvironment(coreInstance, plan, { catalog, policy, policySha256 }) {
    const builder = new WitnessBuilder(coreInstance.rules.maxLayers);
    const replacements = [...(plan.replacements ?? [])];
    const replacementUse = new Map();
    const initialMapping = new Map();
    const bridgeTokenIds = [];
    for (const coreToken of coreInstance.witness.initial) {
        const candidates = replacements.filter(item => item.coreShape === coreToken.shape);
        const used = replacementUse.get(coreToken.shape) ?? 0;
        const replacement = candidates[used];
        let bridgeId;
        if (replacement) {
            replacementUse.set(coreToken.shape, used + 1);
            const pool = replacement.presentedInputs.map(shape => builder.input(shape));
            for (const [index, step] of replacement.derivationGraph.entries()) {
                const inputs = step.inputShapes.map(shape =>
                    takePoolToken(builder, pool, shape, `${plan.id}/graph derivation ${index}`));
                pool.push(...builder.operate(step.operation, inputs, step.params ?? {}));
            }
            bridgeId = takePoolToken(builder, pool, replacement.coreShape, `${plan.id}/graph result`);
        } else bridgeId = builder.input(coreToken.shape);
        initialMapping.set(coreToken.id, bridgeId);
        bridgeTokenIds.push(bridgeId);
    }
    const usedCount = [...replacementUse.values()].reduce((sum, count) => sum + count, 0);
    if (usedCount !== replacements.length) throw new Error(`${plan.id}: replacement does not match a core witness occurrence`);
    const preprocessingStepCount = builder.steps.length;
    const resultId = appendFrozenWitness(builder, coreInstance.witness, initialMapping);
    const coreWitnessBasis = multisetRows(coreInstance.witness.initial.map(token => ({ shape: token.shape, count: 1 })));
    const availableCounts = new Map(coreWitnessBasis.map(row => [row.shape, row.count]));
    for (const replacement of replacements) {
        availableCounts.set(replacement.coreShape, availableCounts.get(replacement.coreShape) - 1);
        if (availableCounts.get(replacement.coreShape) === 0) availableCounts.delete(replacement.coreShape);
        for (const shape of replacement.presentedInputs) availableCounts.set(shape, (availableCounts.get(shape) ?? 0) + 1);
    }
    for (const { shape, count } of plan.additions ?? []) availableCounts.set(shape, (availableCounts.get(shape) ?? 0) + count);
    const availableInputs = canonicalRows(availableCounts);
    const delta = multisetDelta(coreWitnessBasis, availableInputs);
    const instance = {
        schemaVersion: 3,
        id: plan.instanceId,
        suite: coreInstance.suite,
        track: coreInstance.track,
        targetId: coreInstance.targetId,
        target: coreInstance.target,
        partition: DIVERSITY_PILOT_PARTITION,
        coreWitnessBasis,
        availableInputs,
        expansion: {
            policyId: policy.policyId,
            policyVersion: policy.schemaVersion,
            policySha256,
            planId: plan.id,
            kind: 'transformative',
            preprocessingStepCount,
            bridgeTokenIds,
            basisRemoved: delta.removed,
            availableAdded: delta.added,
            sourceInstance: {
                releaseId: BASELINE_RELEASE_ID,
                id: coreInstance.id,
                instanceSha256: coreInstance.instanceSha256,
            },
        },
        rules: structuredClone(coreInstance.rules),
        construction: {
            strategy: 'core+transformative-graph-environment-expansion',
            coreStrategy: coreInstance.construction.strategy,
        },
        witness: builder.witness(resultId),
    };
    const replay = replayWitness(instance, catalog);
    if (!replay.valid) throw new Error(`${plan.id}: expanded forward replay failed: ${replay.phase}: ${replay.errors.join('; ')}`);
    const expansionValidation = validateExpansionMetadata(instance, catalog, replay, policy);
    if (!expansionValidation.valid) throw new Error(`expansion invalid: ${expansionValidation.errors.join('; ')}`);
    return { instance, replay };
}

function ordinaryCatalogShapes(catalog) {
    return ['full', 'partial', 'half'].flatMap(category => catalog.ordinary[category] ?? [])
        .filter(shape => shape !== 'WuWuWuWu')
        .sort();
}

function derivationsFrom(presentedShape, wantedShape, maxDepth = 3) {
    const queue = [{ shape: presentedShape, steps: [], lossy: false }];
    const bestDepth = new Map([[presentedShape, 0]]);
    const found = [];
    while (queue.length) {
        const current = queue.shift();
        if (current.steps.length >= maxDepth) continue;
        for (const [operation, apply] of UNARY_OPERATIONS) {
            const outputs = apply(Shape.fromShapeCode(current.shape))
                .filter(shape => !shape.isEmpty()).map(shape => shape.toShapeCode());
            for (const output of [...new Set(outputs)]) {
                const steps = [...current.steps, { operation, selectShape: output, params: {} }];
                const lossy = current.lossy || operation === 'Cutter' || operation === 'Half Destroyer';
                if (output === wantedShape && lossy) found.push({ presentedShape, coreShape: wantedShape, derivation: steps });
                const depth = steps.length;
                if (depth < maxDepth && depth <= (bestDepth.get(output) ?? Infinity)) {
                    bestDepth.set(output, depth);
                    queue.push({ shape: output, steps, lossy });
                }
            }
        }
    }
    const unique = new Map();
    for (const item of found) {
        const key = canonicalJson(item.derivation);
        if (!unique.has(key)) unique.set(key, item);
    }
    return [...unique.values()].sort((a, b) => a.derivation.length - b.derivation.length
        || a.presentedShape.localeCompare(b.presentedShape)
        || canonicalJson(a.derivation).localeCompare(canonicalJson(b.derivation)));
}

function replacementOptions(source, catalog) {
    const coreShapes = [...new Set(source.witness.initial.map(token => token.shape))];
    const ordinary = new Set(ordinaryCatalogShapes(catalog));
    const options = [];
    for (const coreShape of coreShapes) {
        if (!ordinary.has(coreShape)) continue;
        for (const presentedShape of ordinary) {
            if (presentedShape === coreShape) continue;
            options.push(...derivationsFrom(presentedShape, coreShape));
        }
    }
    const unique = new Map();
    for (const option of options) {
        const key = `${option.coreShape}\0${option.presentedShape}\0${canonicalJson(option.derivation)}`;
        if (!unique.has(key)) unique.set(key, option);
    }
    if (source.targetId === 'hard-main-010') {
        const graphOptions = [
            {
                coreShape: 'CuSu--Cu',
                presentedInputs: ['CuWuSuCu'],
                derivationGraph: [
                    { operation: 'Rotator CW', inputShapes: ['CuWuSuCu'] },
                    { operation: 'Cutter', inputShapes: ['CuCuWuSu'] },
                    { operation: 'Rotator CCW', inputShapes: ['----WuSu'] },
                    { operation: 'Swapper', inputShapes: ['--WuSu--', 'CuCu----'] },
                    { operation: 'Rotator CCW', inputShapes: ['CuCuSu--'] },
                ],
            },
            {
                coreShape: 'CuSu--Cu',
                presentedInputs: ['SuSuRuCu', '--CuWuSu'],
                derivationGraph: [
                    { operation: 'Rotator CW', inputShapes: ['SuSuRuCu'] },
                    { operation: 'Rotator 180', inputShapes: ['--CuWuSu'] },
                    { operation: 'Swapper', inputShapes: ['CuSuSuRu', 'WuSu--Cu'] },
                ],
            },
        ];
        for (const option of graphOptions) unique.set(canonicalJson(option), option);
    }
    return [...unique.values()];
}

function targetVocabulary(target, source) {
    const vocabulary = new Set(parseParts(target).flat()
        .map(part => part.shape).filter(shape => !['-', 'P', 'c', 'X', 'Y'].includes(shape)));
    if (!vocabulary.size) {
        for (const token of source.witness.initial) {
            for (const part of parseParts(token.shape).flat()) {
                if (!['-', 'P', 'c', 'X', 'Y'].includes(part.shape)) vocabulary.add(part.shape);
            }
        }
    }
    return vocabulary;
}

function candidateAdditions(source, targetCase, catalog, bundle, replacements, variant) {
    const coreRows = multisetRows(source.witness.initial.map(token => ({ shape: token.shape, count: 1 })));
    const counts = new Map(coreRows.map(row => [row.shape, row.count]));
    for (const replacement of replacements) {
        counts.set(replacement.coreShape, (counts.get(replacement.coreShape) ?? 0) - 1);
        for (const shape of replacement.presentedInputs ?? [replacement.presentedShape]) {
            counts.set(shape, (counts.get(shape) ?? 0) + 1);
        }
    }
    const additions = [];
    for (const required of bundle.inputs) {
        const missing = required.count - (counts.get(required.shape) ?? 0);
        if (missing > 0) {
            additions.push({ shape: required.shape, count: missing });
            counts.set(required.shape, (counts.get(required.shape) ?? 0) + missing);
        }
    }

    const vocabulary = targetVocabulary(targetCase.target, source);
    const baselineAvailable = new Set(source.availableInputs.map(row => row.shape));
    const replacedCoreShapes = new Set(replacements.map(replacement => replacement.coreShape));
    const ordinary = ordinaryCatalogShapes(catalog)
        .filter(shape => shape !== targetCase.target)
        .filter(shape => !replacedCoreShapes.has(shape))
        .filter(shape => shape !== 'SuSuRuRu' || (targetCase.track === 'side' && !bundle.group))
        .filter(shape => parseParts(shape).flat().some(part => vocabulary.has(part.shape)))
        .sort((a, b) => Number(baselineAvailable.has(a)) - Number(baselineAvailable.has(b)) || a.localeCompare(b));
    if (variant % 2) ordinary.reverse();

    const core = canonicalRows(new Map(coreRows.map(row => [row.shape, row.count])));
    const ordinarySet = new Set(ordinaryCatalogShapes(catalog));
    const desiredOrdinaryDelta = 3;
    for (const shape of ordinary) {
        const currentRows = canonicalRows(counts);
        const ordinaryAdded = sumRows(multisetDelta(core, currentRows).added.filter(row => ordinarySet.has(row.shape)));
        if (ordinaryAdded >= desiredOrdinaryDelta) break;
        if ((counts.get(shape) ?? 0) >= 3) continue;
        const existing = additions.find(row => row.shape === shape);
        if (existing) existing.count += 1; else additions.push({ shape, count: 1 });
        counts.set(shape, (counts.get(shape) ?? 0) + 1);
        const nextOrdinaryAdded = sumRows(multisetDelta(core, canonicalRows(counts)).added.filter(row => ordinarySet.has(row.shape)));
        if (nextOrdinaryAdded > desiredOrdinaryDelta) {
            counts.set(shape, counts.get(shape) - 1);
            if (existing) existing.count -= 1; else additions.pop();
        }
    }
    return additions.filter(row => row.count > 0).sort((a, b) => a.shape.localeCompare(b.shape));
}

function planSpecs(options, cap = 160) {
    const specs = [];
    for (const option of options) specs.push([option]);
    for (let left = 0; left < options.length && specs.length < cap; left++) {
        for (let right = left + 1; right < options.length && specs.length < cap; right++) {
            if (options[left].coreShape === options[right].coreShape) continue;
            specs.push([options[left], options[right]]);
        }
    }
    return specs.slice(0, cap);
}

function environmentComparison(candidate, priorInstances) {
    const signature = canonicalMultiset(candidate.availableInputs);
    const similarities = priorInstances.map(instance => weightedJaccard(signature, canonicalMultiset(instance.availableInputs)));
    const priorTypes = new Set(priorInstances.flatMap(instance => instance.availableInputs.map(row => row.shape)));
    return {
        maxWeightedJaccard: similarities.length ? Math.max(...similarities) : 0,
        baselineWeightedJaccard: similarities[0] ?? 0,
        newInputTypeCount: candidate.availableInputs.filter(row => !priorTypes.has(row.shape)).length,
        availableOccurrenceCount: sumRows(candidate.availableInputs),
        coreOccurrenceCount: sumRows(candidate.coreWitnessBasis),
        expansionDelta: sumRows(candidate.availableInputs) - sumRows(candidate.coreWitnessBasis),
    };
}

function chooseFamilyPair(families, baseline) {
    const representatives = [...families.values()].map(candidates => candidates.sort((a, b) =>
        a.environment.baselineWeightedJaccard - b.environment.baselineWeightedJaccard
        || b.environment.newInputTypeCount - a.environment.newInputTypeCount
        || a.instance.difficulty.operationCount - b.instance.difficulty.operationCount)[0]);
    let best = null;
    for (let left = 0; left < representatives.length; left++) {
        for (let right = left + 1; right < representatives.length; right++) {
            const a = representatives[left]; const b = representatives[right];
            const pairSimilarity = weightedJaccard(canonicalMultiset(a.instance.availableInputs), canonicalMultiset(b.instance.availableInputs));
            const score = Math.max(a.environment.baselineWeightedJaccard, b.environment.baselineWeightedJaccard, pairSimilarity)
                - 0.02 * (a.environment.newInputTypeCount + b.environment.newInputTypeCount);
            if (!best || score < best.score) best = { score, pairSimilarity, candidates: [a, b] };
        }
    }
    if (best) return best;
    if (representatives.length === 1) return { score: Infinity, pairSimilarity: null, candidates: [representatives[0]] };
    return { score: Infinity, pairSimilarity: null, candidates: [] };
}

async function provenance(repositoryPolicy, targetCase) {
    return {
        releaseId: DIVERSITY_PILOT_RELEASE_ID,
        generatorVersion: DIVERSITY_PILOT_VERSION,
        generatorSourceSha256: await fileSha256('benchmarks/tools/build-hard-53x3-diversity-pilot.mjs'),
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

export async function buildHard53x3DiversityPilot({ write = true } = {}) {
    const [catalog, officialManifest, repositoryPolicy, expansionPolicy, baseline, baselineProjection] = await Promise.all([
        readJson(path.join(ROOT, 'benchmarks/input_catalog.json')),
        readJson(path.join(ROOT, 'benchmarks/manifest.json')),
        loadRepositoryPolicy(),
        readJson(path.join(ROOT, 'benchmarks/policy/input-environment-expansion.v1.json')),
        readJson(path.join(ROOT, 'benchmarks/hard-53x1/v1/instances.json')),
        readJson(path.join(ROOT, 'benchmarks/hard-53x1/v1/solver-inputs.json')),
    ]);
    if (artifactContentHash(baseline) !== BASELINE_ARTIFACT_CANONICAL_SHA256 || baseline.sha256 !== BASELINE_INSTANCES_SHA256) {
        throw new Error('frozen Hard 53x1 baseline identity changed; diversity generation stopped');
    }
    if (artifactContentHash(baselineProjection) !== BASELINE_SOLVER_PROJECTION_SHA256) {
        throw new Error('frozen Hard 53x1 solver projection identity changed; diversity generation stopped');
    }
    const compiled = compileCatalog(catalog);
    const expansionPolicySha256 = await fileSha256('benchmarks/policy/input-environment-expansion.v1.json');
    const targetCases = new Map(officialManifest.cases.filter(item => item.suite === 'hard').map(item => [item.id, item]));
    const baselineByTarget = new Map(baseline.instances.map(instance => [instance.targetId, instance]));
    const acceptedInstances = [];
    const attempts = [];
    const status = [];

    for (const targetId of DIVERSITY_PILOT_TARGET_IDS) {
        const source = baselineByTarget.get(targetId);
        const targetCase = targetCases.get(targetId);
        if (!source || !targetCase) throw new Error(`pilot target ${targetId} is absent from frozen baseline/official membership`);
        const baselineReplay = replayWitness(source, catalog);
        if (!baselineReplay.valid) throw new Error(`${targetId}: frozen baseline replay failed; diversity generation stopped`);
        const baselineStructural = deriveStructuralFingerprint(source, baselineReplay);
        if (baselineStructural.signature !== source.diversity.structureSignature) throw new Error(`${targetId}: frozen baseline structural signature changed`);
        const bundle = refinementBundleForTarget(targetCase.target, compiled);
        const options = replacementOptions(source, catalog);
        const families = new Map();
        const targetAttempts = [];
        let serial = 0;
        for (const replacements of planSpecs(options)) {
            serial += 1;
            const descriptor = replacements.map(item => ({
                coreShape: item.coreShape,
                presentedInputs: item.presentedInputs ?? [item.presentedShape],
                derivation: item.derivationGraph
                    ? item.derivationGraph.map(step => `${step.operation}:${step.inputShapes.join('+')}`)
                    : item.derivation.map(step => `${step.operation}:${step.selectShape}`),
            }));
            try {
                const additions = candidateAdditions(source, targetCase, catalog, bundle, replacements, serial);
                const plan = {
                    id: `${targetId}-diversity-transform-${String(serial).padStart(3, '0')}`,
                    instanceId: `${targetId}-53x3-pilot-candidate-${String(serial).padStart(3, '0')}`,
                    targetId,
                    kind: 'transformative',
                    replacements,
                    additions,
                };
                const expansionContext = { catalog, policy: expansionPolicy, policySha256: expansionPolicySha256 };
                const { instance, replay } = replacements.some(item => item.derivationGraph)
                    ? expandGraphWitnessEnvironment(source, plan, expansionContext)
                    : expandWitnessEnvironment(source, plan, expansionContext);
                instance.partition = DIVERSITY_PILOT_PARTITION;
                instance.expansion.sourceInstance = {
                    releaseId: BASELINE_RELEASE_ID,
                    id: source.id,
                    instanceSha256: source.instanceSha256,
                };
                instance.provenance = await provenance(repositoryPolicy, targetCase);
                instance.difficulty = deriveMetadata(instance, replay);
                const structural = deriveStructuralFingerprint(instance, replay);
                const environment = environmentComparison(instance, [source]);
                instance.diversity = {
                    inputMultisetSignature: canonicalMultiset(instance.availableInputs),
                    structureVersion: structural.version,
                    structureSignature: structural.signature,
                    classification: 'representative',
                    duplicateOf: null,
                    maxPriorWeightedJaccard: environment.baselineWeightedJaccard,
                };
                instance.instanceSha256 = instanceContentHash(instance);
                const expansionValidation = validateExpansionMetadata(instance, catalog, replay, expansionPolicy);
                if (!expansionValidation.valid) throw new Error(`expansion invalid: ${expansionValidation.errors.join('; ')}`);
                const duplicateBaseline = structural.signature === baselineStructural.signature;
                const record = {
                    targetId,
                    candidate: serial,
                    accepted: false,
                    baselineFamilySignature: baselineStructural.signature,
                    candidateFamilySignature: structural.signature,
                    replacementTopology: descriptor,
                    expansionKind: instance.expansion.kind,
                    environment,
                    witnessDepth: instance.difficulty.witnessDepth,
                    operationCount: instance.difficulty.operationCount,
                    instance,
                };
                if (duplicateBaseline) {
                    record.category = 'structural duplicate collapse';
                    record.reason = 'candidate canonical family equals frozen baseline family';
                } else {
                    const group = families.get(structural.signature) ?? [];
                    group.push(record);
                    families.set(structural.signature, group);
                }
                targetAttempts.push(record);
            } catch (error) {
                targetAttempts.push({
                    targetId,
                    candidate: serial,
                    accepted: false,
                    baselineFamilySignature: baselineStructural.signature,
                    replacementTopology: descriptor,
                    category: error.message.includes('expansion') ? 'rejected expansion' : 'rejected invalid replay',
                    reason: error.message,
                });
            }
        }

        const selection = chooseFamilyPair(families, source);
        const accepted = selection.candidates;
        for (const [index, candidate] of accepted.entries()) {
            const instance = candidate.instance;
            instance.id = `${targetId}-53x3-pilot-${String(index + 2).padStart(2, '0')}`;
            const prior = [source, ...accepted.slice(0, index).map(item => item.instance)];
            const environment = environmentComparison(instance, prior);
            instance.diversity.maxPriorWeightedJaccard = environment.maxWeightedJaccard;
            instance.instanceSha256 = instanceContentHash(instance);
            candidate.accepted = true;
            candidate.familyNumber = index + 2;
            candidate.environment = environment;
            acceptedInstances.push(instance);
        }
        for (const attempt of targetAttempts) {
            if (attempt.instance) delete attempt.instance;
            if (!attempt.accepted && !attempt.category) {
                const selectedSameFamily = accepted.some(
                    candidate => candidate.candidateFamilySignature === attempt.candidateFamilySignature,
                );
                attempt.category = selectedSameFamily
                    ? 'structural duplicate collapse'
                    : 'environment diversity too narrow';
                attempt.reason = selectedSameFamily
                    ? 'candidate canonical family duplicates the selected representative for that family'
                    : 'valid novel family was not selected by the environment-diversity ranking';
            }
        }
        attempts.push(...targetAttempts);
        const familyCount = 1 + accepted.length;
        let failureCategory = null;
        if (familyCount === 1) failureCategory = 'no second family found';
        if (familyCount === 2) failureCategory = 'second found, third missing';
        status.push({
            targetId,
            baselineInstanceId: source.id,
            baselineFamilySignature: baselineStructural.signature,
            familyCoverage: `${familyCount}/3`,
            acceptedFamilies: accepted.map((candidate, index) => ({
                familyNumber: index + 2,
                structuralSignature: candidate.candidateFamilySignature,
                strategy: 'transformative source-ancestry substitution',
                replacementTopology: candidate.replacementTopology,
                environment: candidate.environment,
                witnessDepth: candidate.witnessDepth,
                operationCount: candidate.operationCount,
            })),
            candidateCount: targetAttempts.length,
            duplicateRejectionCount: targetAttempts.filter(attempt => attempt.category === 'structural duplicate collapse').length,
            failureCategory,
        });
    }

    const targetIds = status.map(item => item.targetId);
    const rejectedCount = attempts.filter(attempt => !attempt.accepted).length;
    const artifact = {
        schemaVersion: 3,
        benchmarkInstanceSchemaVersion: 3,
        name: DIVERSITY_PILOT_RELEASE_ID,
        releaseId: DIVERSITY_PILOT_RELEASE_ID,
        suite: 'hard',
        partition: DIVERSITY_PILOT_PARTITION,
        targetIds,
        candidateCount: attempts.length,
        acceptedCount: acceptedInstances.length,
        rejectedCount,
        instances: acceptedInstances,
    };
    artifact.sha256 = artifactInstancesHash(artifact.instances);
    const solverView = buildSolverEvaluationView(artifact);
    solverView.sha256 = artifactInstancesHash(solverView.instances);
    const result = {
        artifact,
        solverView,
        attempts,
        status,
        baselineReference: {
            artifactReleaseId: BASELINE_RELEASE_ID,
            manifestRevisionId: BASELINE_MANIFEST_REVISION_ID,
            artifactPath: 'benchmarks/hard-53x1/v1/instances.json',
            artifactCanonicalSha256: BASELINE_ARTIFACT_CANONICAL_SHA256,
            instancesSha256: BASELINE_INSTANCES_SHA256,
            solverProjectionSha256: BASELINE_SOLVER_PROJECTION_SHA256,
        },
    };
    if (write) {
        const directory = path.join(ROOT, 'benchmarks/diversity-pilot/v1');
        await mkdir(directory, { recursive: true });
        await writeFile(path.join(directory, 'instances.json'), `${JSON.stringify(artifact, null, 2)}\n`);
        await writeFile(path.join(directory, 'solver-inputs.json'), `${JSON.stringify(solverView, null, 2)}\n`);
        await writeFile(path.join(directory, 'candidate-log.json'), `${JSON.stringify(attempts, null, 2)}\n`);
        await writeFile(path.join(directory, 'target-status.json'), `${JSON.stringify(status, null, 2)}\n`);
        await writeFile(path.join(directory, 'baseline-reference.json'), `${JSON.stringify(result.baselineReference, null, 2)}\n`);
    }
    return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const result = await buildHard53x3DiversityPilot();
    console.log(`Hard 53x3 diversity pilot: ${result.status.filter(item => item.familyCoverage === '3/3').length}/${result.status.length} targets reached 3/3; ${result.artifact.acceptedCount} new instances`);
}
