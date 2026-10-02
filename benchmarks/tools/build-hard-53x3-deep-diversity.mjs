import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
    artifactContentHash, artifactInstancesHash, canonicalMultiset, compileCatalog,
    deriveMetadata, deriveStructuralFingerprint, instanceContentHash, parseParts,
    readJson, refinementBundleForTarget, replayWitness, validateExpansionMetadata,
    weightedJaccard,
} from './benchmark-core.mjs';
import {
    WitnessBuilder, consolidateAvailableInputs,
} from './generation-framework.mjs';
import {
    buildSolverEvaluationView, expandWitnessEnvironment,
} from './environment-expansion.mjs';
import {
    buildMacroPlan, enumerateAlternativeMacroPlans, MACRO_PLAN_ENUMERATOR_VERSION,
} from './macro-plan-enumerator.mjs';
import {
    classifyDiversityDepth, DIVERSITY_DEPTH_CLASSIFIER_VERSION,
} from './diversity-depth-classifier.mjs';
import { fileSha256, loadRepositoryPolicy, ROOT } from './repository-policy.mjs';

export const DEEP_DIVERSITY_RELEASE_ID = 'hard-53x3-deep-replacement-candidates-v1';
export const DEEP_DIVERSITY_VERSION = 'deep-macro-plan-diversity-v1';
export const DEEP_DIVERSITY_BATCH_SIZES = Object.freeze([8, 8, 7, 6]);
const FROZEN_GENERATOR_SOURCE_SHA256 = '732945cb04d68f2bcb4f2013ac966fb3959f06f1ee3e5fba2a02128b53d613a9';

const BASELINE_IDENTITY = Object.freeze({
    releaseId: 'hard-53x1-stage-v1',
    artifactCanonicalSha256: '11005e04e359fff9d0d3a0fec66dd491ca8e441f5c5c880e1ff3441b9fc77da3',
    instancesSha256: '40c4ea586dfeafb5f5e37545101220451d2cc9a9ca2ab54eb9d00a94806c8375',
});
const PILOT_IDENTITY = Object.freeze({
    releaseId: 'hard-53x3-diversity-pilot-v1',
    artifactCanonicalSha256: '9eaf8dc3a64cf68830ea0ec734b8ea6aba0fe67304d8033765125ce6fb6139f0',
    instancesSha256: '9ccffd150764176162ca759c4b9f414c3b308f60a967e6e33e322e0e1968f3a0',
});
const ROLLOUT_IDENTITY = Object.freeze({
    releaseId: 'hard-53x3-rollout-stage-v1',
    artifactCanonicalSha256: '36ffc2397f3fa5c29b0edf0840515c0159008e0bd91c41ac7f4d2407c12064ad',
    instancesSha256: '874369d93095d0a4a69e130d15c36543d2072ff86870ec86106ab01501bf809e',
});

export const KEEP_ALL_TARGET_IDS = Object.freeze([
    'hard-main-001', 'hard-side-003', 'hard-side-005',
]);

export const RETAIN_F2_REPLACE_F3 = Object.freeze([
    'hard-main-004', 'hard-main-005', 'hard-main-006', 'hard-main-010', 'hard-main-011',
    'hard-side-021', 'hard-side-024', 'hard-side-026', 'hard-side-028', 'hard-side-029',
    'hard-side-031', 'hard-side-032', 'hard-side-034', 'hard-side-035', 'hard-side-037',
    'hard-side-039', 'hard-side-040',
]);

export const RETAIN_F3_REPLACE_F2 = Object.freeze([
    'hard-main-007', 'hard-main-008', 'hard-main-009', 'hard-main-012',
    'hard-side-022', 'hard-side-023', 'hard-side-025', 'hard-side-030',
    'hard-side-033', 'hard-side-036', 'hard-side-038', 'hard-side-041',
]);

export const REQUIRED_REPLACEMENT_TARGET_IDS = Object.freeze([
    ...RETAIN_F2_REPLACE_F3, ...RETAIN_F3_REPLACE_F2,
]);

function sumRows(rows) {
    return rows.reduce((sum, row) => sum + row.count, 0);
}

function countBy(items, keyFor) {
    const counts = {};
    for (const item of items) {
        const key = keyFor(item);
        counts[key] = (counts[key] ?? 0) + 1;
    }
    return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function ordinaryCatalogShapes(catalog) {
    return ['full', 'partial', 'half'].flatMap(category => catalog.ordinary[category] ?? [])
        .filter(shape => shape !== 'WuWuWuWu').sort();
}

function targetVocabulary(target) {
    return new Set(parseParts(target).flat().map(part => part.shape)
        .filter(shape => !['-', 'P', 'c', 'X', 'Y'].includes(shape)));
}

export function environmentAdditions(core, targetCase, catalog, bundle, variant) {
    const counts = new Map(core.witness.initial.map(token => [token.shape, 0]));
    for (const token of core.witness.initial) counts.set(token.shape, (counts.get(token.shape) ?? 0) + 1);
    const additions = [];
    for (const required of bundle.inputs) {
        const missing = required.count - (counts.get(required.shape) ?? 0);
        if (missing > 0) {
            additions.push({ shape: required.shape, count: missing });
            counts.set(required.shape, required.count);
        }
    }
    const vocabulary = targetVocabulary(targetCase.target);
    if (!vocabulary.size) {
        for (const token of core.witness.initial) {
            for (const part of parseParts(token.shape).flat()) {
                if (!['-', 'P', 'c', 'X', 'Y'].includes(part.shape)) vocabulary.add(part.shape);
            }
        }
    }
    const ordinary = ordinaryCatalogShapes(catalog).filter(shape => shape !== targetCase.target)
        .filter(shape => shape !== 'SuSuRuRu' || (targetCase.track === 'side' && !bundle.group))
        .filter(shape => parseParts(shape)[0].some(part => vocabulary.has(part.shape)));
    const ordered = [...ordinary.slice(variant % Math.max(ordinary.length, 1)), ...ordinary.slice(0, variant % Math.max(ordinary.length, 1))];
    let added = 0;
    for (const shape of ordered) {
        if (added >= 2) break;
        if ((counts.get(shape) ?? 0) >= 3) continue;
        additions.push({ shape, count: 1 });
        counts.set(shape, (counts.get(shape) ?? 0) + 1);
        added += 1;
    }
    if (!added) throw new Error('environment expansion found no related ordinary addition');
    return additions.sort((a, b) => a.shape.localeCompare(b.shape));
}

export function makeCoreInstance(targetCase, builder, resultId, bundle, macroPlan, catalog) {
    const inputs = consolidateAvailableInputs(builder.initial, bundle.inputs);
    const core = {
        schemaVersion: 2,
        id: `${targetCase.id}-deep-core-${macroPlan.id}`,
        suite: 'hard',
        track: targetCase.track,
        targetId: targetCase.id,
        target: targetCase.target,
        partition: 'expansion-pilot',
        inputs,
        rules: { maxLayers: 4, cleanPainting: true, allowSplitting: false },
        provenance: {},
        construction: { strategy: macroPlan.macroClass },
        witness: builder.witness(resultId),
    };
    const replay = replayWitness(core, catalog);
    if (!replay.valid) throw new Error(`core replay invalid: ${replay.phase}: ${replay.errors.join('; ')}`);
    core.difficulty = deriveMetadata(core, replay);
    const structural = deriveStructuralFingerprint(core, replay);
    core.diversity = {
        inputMultisetSignature: canonicalMultiset(inputs),
        structureVersion: structural.version,
        structureSignature: structural.signature,
        classification: 'representative',
        duplicateOf: null,
        maxPriorWeightedJaccard: 0,
    };
    core.instanceSha256 = instanceContentHash(core);
    return core;
}

export function environmentComparison(candidate, prior) {
    const signature = canonicalMultiset(candidate.availableInputs);
    const similarities = prior.map(instance => weightedJaccard(signature, canonicalMultiset(instance.availableInputs)));
    const priorTypes = new Set(prior.flatMap(instance => instance.availableInputs.map(row => row.shape)));
    return {
        maxWeightedJaccard: Math.max(...similarities),
        baselineWeightedJaccard: similarities[0],
        newInputTypeCount: candidate.availableInputs.filter(row => !priorTypes.has(row.shape)).length,
        availableOccurrenceCount: sumRows(candidate.availableInputs),
        coreOccurrenceCount: sumRows(candidate.coreWitnessBasis),
    };
}

function naturalnessRank(macroClass) {
    return ({
        'alternate-pin-support-lifetime': 0,
        'pin-column-support-partition': 0,
        'alternate-crystal-staging-boundary': 0,
        'mixed-state-transition-routing': 0,
        'layer-local-crystal-staging': 0,
        'full-stack-pin-mask-crystal-staging': 0,
        'staged-full-stack-pin-mask-crystal-routing': 0,
        'pin-mask-crystal-staging': 0,
        'column-first-assembly': 1,
        'chunked-upper-half-recomposition': 1,
        'crystal-staging-route': 1,
        'independent-half-swapper-assembly': 2,
        'rotated-half-swapper-assembly': 3,
        'direct-layered': 4,
    })[macroClass] ?? 5;
}

function rankCandidates(candidates) {
    return [...candidates].sort((a, b) => naturalnessRank(a.macroPlanClass) - naturalnessRank(b.macroPlanClass)
        || a.environment.maxWeightedJaccard - b.environment.maxWeightedJaccard
        || b.environment.newInputTypeCount - a.environment.newInputTypeCount
        || a.operationCount - b.operationCount
        || a.serial - b.serial);
}

export async function provenance(repositoryPolicy, targetCase) {
    return {
        releaseId: DEEP_DIVERSITY_RELEASE_ID,
        generatorVersion: `${DEEP_DIVERSITY_VERSION}+${MACRO_PLAN_ENUMERATOR_VERSION}+${DIVERSITY_DEPTH_CLASSIFIER_VERSION}`,
        // Historical release provenance is frozen even though the module now
        // exposes a read-only targeted recovery entry point.
        generatorSourceSha256: FROZEN_GENERATOR_SOURCE_SHA256,
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

function rejectionSummary(attempt) {
    return {
        candidate: attempt.candidate,
        macroPlanClass: attempt.macroPlanClass,
        category: attempt.category,
        reason: attempt.reason,
        candidateSignature: attempt.candidateSignature ?? null,
        depthLevel: attempt.depthLevel ?? null,
    };
}

function makeCheckpoint(batchNumber, targetIds, statuses, attempts) {
    const targetSet = new Set(targetIds);
    const rows = statuses.filter(row => targetSet.has(row.targetId));
    const batchAttempts = attempts.filter(row => targetSet.has(row.targetId));
    return {
        batchNumber,
        targetIds,
        replacementsFound: rows.filter(row => row.status === 'DEEP_REPLACEMENT_FOUND').map(row => row.targetId),
        noDeepRoute: rows.filter(row => row.status !== 'DEEP_REPLACEMENT_FOUND').map(row => row.targetId),
        structuralDuplicates: batchAttempts.filter(row => row.category === 'structural duplicate').length,
        replayInvalid: batchAttempts.filter(row => row.category === 'replay invalid').length,
        macroPlanCandidateCount: batchAttempts.length,
        depthDistribution: countBy(batchAttempts.filter(row => row.depthLevel), row => row.depthLevel),
    };
}

function assertIdentity(artifact, expected, role) {
    const canonical = artifactContentHash(artifact);
    if (canonical !== expected.artifactCanonicalSha256 || artifact.sha256 !== expected.instancesSha256) {
        throw new Error(`${role} frozen identity changed; deep pass stopped (${canonical}, ${artifact.sha256})`);
    }
}

function reportMarkdown(statistics, statuses, unknownStatuses) {
    const requiredLines = statuses.map(row => (
        `| ${row.targetId} | F${row.retainedFamily} | F${row.replacedFamily} | ${row.candidateDepth ?? '-'} | ${row.macroPlanClass ?? '-'} | ${row.environmentChange ?? '-'} | ${row.status} |`
    ));
    const unknownLines = unknownStatuses.map(row => `| ${row.targetId} | ${row.status} | ${row.reason} |`);
    return `# Hard 53×3 Deep Macro-Plan Diversity Pass\n\n`
        + `Status: ${statistics.recommendation}\n\n`
        + `## Required 29\n\n- C/D/E replacement found: ${statistics.required.deepReplacementFound}\n- still shallow: ${statistics.required.stillShallow}\n- reclassified probably limited: ${statistics.required.probablyLimited}\n\n`
        + `Depth distribution: ${JSON.stringify(statistics.depthDistribution)}\n\n`
        + `| Target | Retained | Replaced | Depth | Macro topology | Environment | Status |\n|---|---:|---:|---|---|---|---|\n${requiredLines.join('\n')}\n\n`
        + `## Macro-plan classes discovered\n\n${JSON.stringify(statistics.macroPlanClassesDiscovered, null, 2)}\n\n`
        + `## Unknown 21 feasibility\n\n| Target | Classification | Evidence |\n|---|---|---|\n${unknownLines.join('\n')}\n\n`
        + `## Candidate funnel\n\n${JSON.stringify(statistics.candidateFunnel, null, 2)}\n\n`
        + `## Integrity\n\n- no baseline changes\n- no retained pilot/rollout family changes\n- no structural canonicalization changes\n- no Solver filtering\n- no artificial mechanism injection\n- no composite release constructed\n`;
}

async function writeOutputs(directory, state) {
    await mkdir(directory, { recursive: true });
    const requiredAttempts = state.attempts.filter(item => REQUIRED_REPLACEMENT_TARGET_IDS.includes(item.targetId));
    const artifact = {
        schemaVersion: 3,
        benchmarkInstanceSchemaVersion: 3,
        name: DEEP_DIVERSITY_RELEASE_ID,
        releaseId: DEEP_DIVERSITY_RELEASE_ID,
        suite: 'hard',
        partition: 'expansion-pilot',
        targetIds: state.instances.map(instance => instance.targetId),
        candidateCount: requiredAttempts.length,
        acceptedCount: state.instances.length,
        rejectedCount: requiredAttempts.filter(item => !item.accepted).length,
        instances: state.instances,
    };
    artifact.sha256 = artifactInstancesHash(artifact.instances);
    const solverView = buildSolverEvaluationView(artifact);
    solverView.sha256 = artifactInstancesHash(solverView.instances);
    await Promise.all([
        writeFile(path.join(directory, 'instances.json'), `${JSON.stringify(artifact, null, 2)}\n`),
        writeFile(path.join(directory, 'solver-inputs.json'), `${JSON.stringify(solverView, null, 2)}\n`),
        writeFile(path.join(directory, 'candidate-log.json'), `${JSON.stringify(state.attempts, null, 2)}\n`),
        writeFile(path.join(directory, 'target-status.json'), `${JSON.stringify(state.statuses, null, 2)}\n`),
        writeFile(path.join(directory, 'unknown-feasibility.json'), `${JSON.stringify(state.unknownStatuses, null, 2)}\n`),
        writeFile(path.join(directory, 'optional-candidates.json'), `${JSON.stringify(state.optionalCandidates, null, 2)}\n`),
        writeFile(path.join(directory, 'statistics.json'), `${JSON.stringify(state.statistics, null, 2)}\n`),
        writeFile(path.join(directory, 'integrity.json'), `${JSON.stringify(state.integrity, null, 2)}\n`),
        writeFile(path.join(directory, 'REPORT.md'), reportMarkdown(state.statistics, state.statuses, state.unknownStatuses)),
        ...state.checkpoints.map(checkpoint => writeFile(
            path.join(directory, `checkpoint-${String(checkpoint.batchNumber).padStart(2, '0')}.json`),
            `${JSON.stringify(checkpoint, null, 2)}\n`,
        )),
    ]);
    return { artifact, solverView };
}

export async function buildHard53x3DeepDiversity({
    write = true,
    targetIds = null,
    retainCandidateInstances = false,
} = {}) {
    const [catalog, official, repositoryPolicy, expansionPolicy, baseline, pilot, rollout] = await Promise.all([
        readJson(path.join(ROOT, 'benchmarks/input_catalog.json')),
        readJson(path.join(ROOT, 'benchmarks/manifest.json')),
        loadRepositoryPolicy(),
        readJson(path.join(ROOT, 'benchmarks/policy/input-environment-expansion.v1.json')),
        readJson(path.join(ROOT, 'benchmarks/hard-53x1/v1/instances.json')),
        readJson(path.join(ROOT, 'benchmarks/diversity-pilot/v1/instances.json')),
        readJson(path.join(ROOT, 'benchmarks/hard-53x3-rollout/v1/instances.json')),
    ]);
    assertIdentity(baseline, BASELINE_IDENTITY, 'baseline');
    assertIdentity(pilot, PILOT_IDENTITY, 'pilot');
    assertIdentity(rollout, ROLLOUT_IDENTITY, 'rollout');
    const baselineIdentityBefore = artifactContentHash(baseline);
    const pilotIdentityBefore = artifactContentHash(pilot);
    const rolloutIdentityBefore = artifactContentHash(rollout);
    const expansionPolicySha256 = await fileSha256('benchmarks/policy/input-environment-expansion.v1.json');
    const compiled = compileCatalog(catalog);
    const targets = official.cases.filter(item => item.suite === 'hard');
    const targetById = new Map(targets.map(target => [target.id, target]));
    const baselineByTarget = new Map(baseline.instances.map(instance => [instance.targetId, instance]));
    const overlayByTarget = new Map();
    for (const instance of [...pilot.instances, ...rollout.instances]) {
        const list = overlayByTarget.get(instance.targetId) ?? [];
        list.push(instance);
        list.sort((a, b) => a.id.localeCompare(b.id));
        overlayByTarget.set(instance.targetId, list);
    }
    const requiredSet = new Set(REQUIRED_REPLACEMENT_TARGET_IDS);
    const keepAllSet = new Set(KEEP_ALL_TARGET_IDS);
    const unknownTargetIds = targets.map(target => target.id).filter(id => !requiredSet.has(id) && !keepAllSet.has(id));
    if (targets.length !== 53 || requiredSet.size !== 29 || keepAllSet.size !== 3 || unknownTargetIds.length !== 21) {
        throw new Error('53-target authority partition mismatch');
    }
    const requestedSet = targetIds ? new Set(targetIds) : null;
    if (requestedSet) {
        const unknownRequested = [...requestedSet].filter(id => !targetById.has(id));
        if (unknownRequested.length) throw new Error(`unknown targeted recovery ids: ${unknownRequested.join(', ')}`);
    }

    const instances = [];
    const optionalCandidates = [];
    const attempts = [];
    const statuses = [];
    const checkpoints = [];

    async function searchTarget(targetId, { optional = false } = {}) {
        const targetCase = targetById.get(targetId);
        const source = baselineByTarget.get(targetId);
        const overlays = overlayByTarget.get(targetId) ?? [];
        if (!targetCase || !source || overlays.length !== 2) throw new Error(`${targetId}: incomplete staged family context`);
        const retainF2 = RETAIN_F2_REPLACE_F3.includes(targetId);
        const retainedFamily = optional ? null : (retainF2 ? 2 : 3);
        const replacedFamily = optional ? null : (retainF2 ? 3 : 2);
        const retained = optional ? null : overlays[retainedFamily - 2];
        const replaced = optional ? null : overlays[replacedFamily - 2];
        const baselineReplay = replayWitness(source, catalog);
        if (!baselineReplay.valid) throw new Error(`${targetId}: frozen baseline replay invalid`);
        const baselineStructural = deriveStructuralFingerprint(source, baselineReplay);
        const bundle = refinementBundleForTarget(targetCase.target, compiled);
        let macroPlans = enumerateAlternativeMacroPlans(targetCase);
        const hasSpecial = parseParts(targetCase.target).flat().some(part => ['P', 'c'].includes(part.shape));
        if (optional && !hasSpecial) {
            macroPlans = macroPlans.filter(plan => !plan.macroClass.includes('swapper'));
        }
        const targetAttempts = [];
        const validDeep = [];
        for (const [index, macroPlan] of macroPlans.entries()) {
            const serial = index + 1;
            const baseRecord = {
                targetId,
                candidate: serial,
                macroPlanId: macroPlan.id,
                macroPlanClass: macroPlan.macroClass,
                accepted: false,
                baselineSignature: baselineStructural.signature,
                retainedSignature: retained?.diversity.structureSignature ?? null,
                replacedSignature: replaced?.diversity.structureSignature ?? null,
            };
            try {
                const builder = new WitnessBuilder(4);
                const resultId = buildMacroPlan(builder, targetCase, catalog, bundle, macroPlan);
                const core = makeCoreInstance(targetCase, builder, resultId, bundle, macroPlan, catalog);
                const plan = {
                    id: `${targetId}-deep-environment-${String(serial).padStart(2, '0')}`,
                    instanceId: `${targetId}-deep-candidate-${String(serial).padStart(2, '0')}`,
                    targetId,
                    partition: 'expansion-pilot',
                    kind: 'additive',
                    additions: environmentAdditions(core, targetCase, catalog, bundle, serial),
                };
                const { instance, replay } = expandWitnessEnvironment(core, plan, {
                    catalog, policy: expansionPolicy, policySha256: expansionPolicySha256,
                });
                instance.expansion.sourceInstance = {
                    releaseId: 'hard-53x3-deep-core-stage-v1',
                    id: core.id,
                    instanceSha256: core.instanceSha256,
                };
                instance.provenance = await provenance(repositoryPolicy, targetCase);
                instance.difficulty = deriveMetadata(instance, replay);
                const structural = deriveStructuralFingerprint(instance, replay);
                const prior = [source, ...overlays];
                const environment = environmentComparison(instance, prior);
                instance.diversity = {
                    inputMultisetSignature: canonicalMultiset(instance.availableInputs),
                    structureVersion: structural.version,
                    structureSignature: structural.signature,
                    classification: 'representative',
                    duplicateOf: null,
                    maxPriorWeightedJaccard: environment.maxWeightedJaccard,
                };
                instance.instanceSha256 = instanceContentHash(instance);
                const expansion = validateExpansionMetadata(instance, catalog, replay, expansionPolicy);
                if (!expansion.valid) throw new Error(`expansion invalid: ${expansion.errors.join('; ')}`);
                const depth = classifyDiversityDepth(source, baselineReplay, instance, replay);
                const record = {
                    ...baseRecord,
                    candidateSignature: structural.signature,
                    depthLevel: depth.level,
                    depth,
                    environment,
                    replayResult: { valid: true, phase: replay.phase },
                    expansionResult: { valid: true, kind: instance.expansion.kind },
                    operationCount: instance.difficulty.operationCount,
                    witnessDepth: instance.difficulty.witnessDepth,
                    instance,
                };
                if (structural.signature === baselineStructural.signature) {
                    record.category = 'structural duplicate';
                    record.reason = 'candidate signature equals frozen baseline';
                } else if (overlays.some(item => item.diversity.structureSignature === structural.signature)) {
                    record.category = 'structural duplicate';
                    record.reason = 'candidate signature equals an existing staged family';
                } else if (!['C', 'D', 'E'].includes(depth.level)) {
                    record.category = 'B-only';
                    record.reason = `mechanical depth classifier returned Level ${depth.level}`;
                } else {
                    record.category = 'C/D/E';
                    record.reason = depth.rationale;
                    validDeep.push(record);
                }
                targetAttempts.push(record);
            } catch (error) {
                targetAttempts.push({
                    ...baseRecord,
                    category: error.message.includes('expansion') ? 'expansion invalid' : 'replay invalid',
                    reason: error.message,
                    replayResult: { valid: false },
                });
            }
        }
        const selected = rankCandidates(validDeep)[0] ?? null;
        let selectedInstance = null;
        if (selected) {
            selected.accepted = true;
            selected.instance.id = optional
                ? `${targetId}-deep-optional-01`
                : `${targetId}-deep-replacement-f${replacedFamily}`;
            selected.instance.instanceSha256 = instanceContentHash(selected.instance);
            selectedInstance = selected.instance;
        }
        for (const attempt of targetAttempts) {
            if (attempt.instance && !retainCandidateInstances) delete attempt.instance;
            if (!attempt.accepted && attempt.category === 'C/D/E') {
                attempt.category = 'valid but lower-ranked';
                attempt.reason = 'another replay-valid deep macro plan ranked higher on naturalness, environment, and complexity';
            }
        }
        attempts.push(...targetAttempts);
        return { selected, selectedInstance, targetAttempts, retainedFamily, replacedFamily, retained, replaced, source, macroPlans };
    }

    let cursor = 0;
    for (const [batchIndex, batchSize] of DEEP_DIVERSITY_BATCH_SIZES.entries()) {
        const batchIds = REQUIRED_REPLACEMENT_TARGET_IDS.slice(cursor, cursor + batchSize)
            .filter(targetId => !requestedSet || requestedSet.has(targetId));
        cursor += batchSize;
        for (const targetId of batchIds) {
            const result = await searchTarget(targetId);
            if (result.selected) instances.push(result.selectedInstance);
            const mechanicallyValid = result.targetAttempts.filter(item => item.replayResult?.valid);
            const onlyShallow = mechanicallyValid.length > 0 && mechanicallyValid.every(item => ['A', 'B'].includes(item.depthLevel));
            const status = result.selected ? 'DEEP_REPLACEMENT_FOUND'
                : onlyShallow && mechanicallyValid.length >= 2 ? 'PROBABLY_LIMITED' : 'STILL_SHALLOW';
            statuses.push({
                targetId,
                retainedFamily: result.retainedFamily,
                retainedInstanceId: result.retained.id,
                retainedSignature: result.retained.diversity.structureSignature,
                replacedFamily: result.replacedFamily,
                replacedInstanceId: result.replaced.id,
                replacedSignature: result.replaced.diversity.structureSignature,
                baselineSignature: result.source.diversity.structureSignature,
                newSignature: result.selected?.candidateSignature ?? null,
                candidateDepth: result.selected?.depthLevel ?? null,
                earliestDivergenceNode: result.selected?.depth.earliestSubstantiveDivergence ?? null,
                rejoinPoint: result.selected?.depth.rejoinPoint ?? null,
                mainCoreTailRemainsIdentical: result.selected?.depth.mainCoreTailRemainsIdentical ?? null,
                macroPlanClass: result.selected?.macroPlanClass ?? null,
                replayResult: result.selected?.replayResult ?? null,
                environmentExpansion: result.selected?.environment ?? null,
                environmentChange: result.selected
                    ? `${result.selected.environment.newInputTypeCount} new types; J=${result.selected.environment.maxWeightedJaccard.toFixed(3)}`
                    : null,
                rejectionHistory: result.targetAttempts.filter(item => !item.accepted).map(rejectionSummary),
                searchedMacroPlanClasses: [...new Set(result.macroPlans.map(plan => plan.macroClass))],
                status,
            });
        }
        checkpoints.push(makeCheckpoint(batchIndex + 1, batchIds, statuses, attempts));
    }

    const unknownStatuses = [];
    for (const targetId of unknownTargetIds.filter(targetId => !requestedSet || requestedSet.has(targetId))) {
        const result = await searchTarget(targetId, { optional: true });
        if (result.selected) optionalCandidates.push(result.selectedInstance);
        const valid = result.targetAttempts.filter(item => item.replayResult?.valid);
        const status = result.selected ? 'DEEP_ROUTE_FOUND'
            : valid.length >= 2 && valid.every(item => ['A', 'B'].includes(item.depthLevel))
                ? 'PROBABLY_LIMITED' : 'UNKNOWN_AFTER_SEARCH';
        const collapseReasons = result.targetAttempts.map(item => `${item.macroPlanClass}: ${item.reason}`);
        unknownStatuses.push({
            targetId,
            status,
            candidateDepth: result.selected?.depthLevel ?? null,
            macroPlanClass: result.selected?.macroPlanClass ?? null,
            candidateSignature: result.selected?.candidateSignature ?? null,
            searchedMacroPlanClasses: [...new Set(result.macroPlans.map(plan => plan.macroClass))],
            reason: result.selected ? result.selected.depth.rationale
                : collapseReasons.join(' | '),
        });
    }

    const requiredAttempts = attempts.filter(item => requiredSet.has(item.targetId));
    const acceptedRows = statuses.filter(row => row.status === 'DEEP_REPLACEMENT_FOUND');
    const statistics = {
        required: {
            deepReplacementFound: acceptedRows.length,
            stillShallow: statuses.filter(row => row.status === 'STILL_SHALLOW').length,
            probablyLimited: statuses.filter(row => row.status === 'PROBABLY_LIMITED').length,
        },
        depthDistribution: countBy(acceptedRows, row => row.candidateDepth),
        macroPlanClassesDiscovered: countBy(acceptedRows, row => row.macroPlanClass),
        unknownFeasibility: countBy(unknownStatuses, row => row.status),
        candidateFunnel: {
            macroCandidates: requiredAttempts.length,
            replayInvalid: requiredAttempts.filter(row => row.category === 'replay invalid').length,
            expansionInvalid: requiredAttempts.filter(row => row.category === 'expansion invalid').length,
            structuralDuplicate: requiredAttempts.filter(row => row.category === 'structural duplicate').length,
            bOnly: requiredAttempts.filter(row => row.category === 'B-only').length,
            cde: requiredAttempts.filter(row => ['C/D/E', 'valid but lower-ranked'].includes(row.category) || row.accepted).length,
            accepted: requiredAttempts.filter(row => row.accepted).length,
        },
        recommendation: acceptedRows.length >= 24
            ? 'diversity quality acceptable → perform final depth re-audit'
            : acceptedRows.length >= 18
                ? 'small number of explicit gaps → targeted follow-up'
                : 'macro-plan generator insufficient → stop and redesign planner coverage',
    };
    const integrity = {
        baselineUnchanged: artifactContentHash(baseline) === baselineIdentityBefore,
        pilotRetainedFamiliesUnchanged: artifactContentHash(pilot) === pilotIdentityBefore,
        rolloutRetainedFamiliesUnchanged: artifactContentHash(rollout) === rolloutIdentityBefore,
        baselineIdentity: BASELINE_IDENTITY,
        pilotIdentity: PILOT_IDENTITY,
        rolloutIdentity: ROLLOUT_IDENTITY,
        structuralCanonicalizationChanged: false,
        solverFilteringUsed: false,
        artificialMechanismInjectionUsed: false,
        compositeReleaseConstructed: false,
    };
    const state = { instances, optionalCandidates, attempts, statuses, unknownStatuses, checkpoints, statistics, integrity };
    const directory = path.join(ROOT, 'benchmarks/hard-53x3-deep-diversity/v1');
    const output = write ? await writeOutputs(directory, state) : null;
    return { ...state, ...output };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const result = await buildHard53x3DeepDiversity();
    console.log(JSON.stringify({
        required: result.statistics.required,
        depthDistribution: result.statistics.depthDistribution,
        unknownFeasibility: result.statistics.unknownFeasibility,
        candidateFunnel: result.statistics.candidateFunnel,
        recommendation: result.statistics.recommendation,
    }, null, 2));
}
