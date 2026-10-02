import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
    artifactContentHash, artifactInstancesHash, canonicalMultiset, compileCatalog,
    deriveMetadata, deriveStructuralFingerprint, instanceContentHash, readJson,
    refinementBundleForTarget, replayWitness, validateExpansionMetadata,
} from './benchmark-core.mjs';
import {
    buildHard53x3DeepDiversity, environmentAdditions, environmentComparison,
    makeCoreInstance, provenance,
} from './build-hard-53x3-deep-diversity.mjs';
import { WitnessBuilder } from './generation-framework.mjs';
import { buildMacroPlan } from './macro-plan-enumerator.mjs';
import { buildSolverEvaluationView, expandWitnessEnvironment } from './environment-expansion.mjs';
import {
    classifyTargetRelativeDepth, TARGET_RELATIVE_DEPTH_POLICY_VERSION,
} from './diversity-depth-classifier.mjs';
import { fileSha256, loadRepositoryPolicy, ROOT } from './repository-policy.mjs';

export const FINAL_DEPTH_RESELECTION_RELEASE_ID = 'hard-final-depth-reselection-candidates-v1';
export const FINAL_DEPTH_RESELECTION_VERSION = 'final-targeted-depth-reselection-v1';

export const RESELECTION_TARGET_IDS = Object.freeze([
    'hard-main-005', 'hard-main-006', 'hard-main-007',
    'hard-side-022', 'hard-side-023', 'hard-side-025', 'hard-side-026',
    'hard-side-028', 'hard-side-031', 'hard-side-035', 'hard-side-036',
]);

// Candidate numbers are immutable positions in the committed Deep Pass funnel.
// No new candidate is enumerated for these eleven targets.
export const RECOVERED_SELECTIONS = Object.freeze({
    'hard-main-005': 6,
    'hard-main-006': 8,
    'hard-main-007': 2,
    'hard-side-022': 6,
    'hard-side-023': 6,
    'hard-side-025': 10,
    'hard-side-026': 6,
    'hard-side-028': 10,
    'hard-side-031': 10,
    'hard-side-035': 6,
    'hard-side-036': 8,
});

const HARD_MAIN_010 = 'hard-main-010';

function countBy(items, keyFor) {
    const counts = {};
    for (const item of items) {
        const key = keyFor(item);
        counts[key] = (counts[key] ?? 0) + 1;
    }
    return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function clone(value) {
    return structuredClone(value);
}

function reportMarkdown(state) {
    const rows = state.reselection.map(row => (
        `| ${row.targetId} | ${row.candidateRecovered ? 'yes' : 'no'} | #${row.oldRejectedCandidate} | #${row.originalCandidateId} | ${row.depth} | ${row.macroClass} | ${row.baselineOperations} | ${row.candidateOperations} | ${row.earliestDivergence?.path ?? '-'} | ${row.rejoin?.nodeKind ?? '-'} | ${row.accepted ? 'ACCEPTED' : 'REJECTED'} |`
    ));
    const feasibility = state.hardMain010;
    return `# Final Diversity Depth Targeted Re-selection\n\n`
        + `Status: ${state.statistics.recommendation}\n\n`
        + `## 11-target re-selection\n\n`
        + `| Target | Recovered | Old rejected | New | Depth | Macro class | Baseline ops | Candidate ops | Earliest divergence | Rejoin | Decision |\n`
        + `|---|---:|---:|---:|---|---|---:|---:|---|---|---|\n${rows.join('\n')}\n\n`
        + `- 11/11 replacement found: ${state.statistics.reselection.replacementsFound}\n`
        + `- remaining gaps: ${state.statistics.reselection.remainingGaps}\n`
        + `- depth distribution: ${JSON.stringify(state.statistics.reselection.depthDistribution)}\n\n`
        + `## hard-main-010\n\n`
        + `- macro classes searched: ${feasibility.macroClassesSearched.join(', ')}\n`
        + `- candidate count: ${feasibility.candidateCount}\n`
        + `- replay failures: ${feasibility.replayFailures}\n`
        + `- shallow collapses: ${feasibility.shallowCollapses}\n`
        + `- deep candidates: ${feasibility.deepCandidates}\n`
        + `- final classification: ${feasibility.finalClassification}\n`
        + `- accepted signature: ${feasibility.accepted?.signature ?? '-'}\n`
        + `- accepted operations: ${feasibility.accepted?.operationCount ?? '-'}\n\n`
        + `## Proposed replacement total\n\n`
        + `30 accepted + ${state.statistics.reselection.replacementsFound} recovered + ${feasibility.finalClassification === 'DEEP_ROUTE_FOUND' ? 1 : 0} hard-main-010 promotion = ${state.statistics.proposedReplacementTotal}.\n\n`
        + `No final staged composition was written.\n\n`
        + `## Integrity\n\n`
        + `- baseline unchanged\n- existing accepted candidate artifacts unchanged\n`
        + `- no structural canonicalization changes\n- no schema/validator changes\n`
        + `- no composite release\n- no Solver filtering\n- no 53×5\n- no Insane\n`;
}

async function materializeFeasibilityCandidate({
    macroPlan, serial, targetCase, source, catalog, compiled, expansionPolicy,
    expansionPolicySha256, repositoryPolicy, prior,
}) {
    const bundle = refinementBundleForTarget(targetCase.target, compiled);
    const builder = new WitnessBuilder(4);
    const resultId = buildMacroPlan(builder, targetCase, catalog, bundle, macroPlan);
    const core = makeCoreInstance(targetCase, builder, resultId, bundle, macroPlan, catalog);
    const expansionPlan = {
        id: `${HARD_MAIN_010}-final-feasibility-environment-${serial}`,
        instanceId: `${HARD_MAIN_010}-final-feasibility-${serial}`,
        targetId: HARD_MAIN_010,
        partition: 'expansion-pilot',
        kind: 'additive',
        additions: environmentAdditions(core, targetCase, catalog, bundle, 40 + serial),
    };
    const { instance, replay } = expandWitnessEnvironment(core, expansionPlan, {
        catalog, policy: expansionPolicy, policySha256: expansionPolicySha256,
    });
    instance.expansion.sourceInstance = {
        releaseId: 'hard-final-depth-feasibility-core-v1',
        id: core.id,
        instanceSha256: core.instanceSha256,
    };
    instance.provenance = {
        ...await provenance(repositoryPolicy, targetCase),
        releaseId: FINAL_DEPTH_RESELECTION_RELEASE_ID,
        generatorVersion: `${FINAL_DEPTH_RESELECTION_VERSION}+${TARGET_RELATIVE_DEPTH_POLICY_VERSION}`,
        generatorSourceSha256: await fileSha256('benchmarks/tools/build-final-depth-reselection.mjs'),
    };
    instance.difficulty = deriveMetadata(instance, replay);
    const structural = deriveStructuralFingerprint(instance, replay);
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
    if (!expansion.valid) throw new Error(`${macroPlan.id}: expansion invalid: ${expansion.errors.join('; ')}`);
    const depth = classifyTargetRelativeDepth(source, replayWitness(source, catalog), instance, replay);
    return { macroPlan, instance, replay, structural, environment, depth };
}

async function writeOutputs(directory, state) {
    await mkdir(directory, { recursive: true });
    const artifact = {
        schemaVersion: 3,
        benchmarkInstanceSchemaVersion: 3,
        name: FINAL_DEPTH_RESELECTION_RELEASE_ID,
        releaseId: FINAL_DEPTH_RESELECTION_RELEASE_ID,
        suite: 'hard',
        partition: 'expansion-pilot',
        targetIds: state.instances.map(instance => instance.targetId),
        candidateCount: state.instances.length,
        acceptedCount: state.instances.length,
        rejectedCount: 0,
        instances: state.instances,
    };
    artifact.sha256 = artifactInstancesHash(artifact.instances);
    const solverView = buildSolverEvaluationView(artifact);
    solverView.sha256 = artifactInstancesHash(solverView.instances);
    await Promise.all([
        writeFile(path.join(directory, 'instances.json'), `${JSON.stringify(artifact, null, 2)}\n`),
        writeFile(path.join(directory, 'solver-inputs.json'), `${JSON.stringify(solverView, null, 2)}\n`),
        writeFile(path.join(directory, 'reselection.json'), `${JSON.stringify(state.reselection, null, 2)}\n`),
        writeFile(path.join(directory, 'candidate-log.json'), `${JSON.stringify(state.candidateLog, null, 2)}\n`),
        writeFile(path.join(directory, 'hard-main-010-feasibility.json'), `${JSON.stringify(state.hardMain010, null, 2)}\n`),
        writeFile(path.join(directory, 'statistics.json'), `${JSON.stringify(state.statistics, null, 2)}\n`),
        writeFile(path.join(directory, 'integrity.json'), `${JSON.stringify(state.integrity, null, 2)}\n`),
        writeFile(path.join(directory, 'REPORT.md'), reportMarkdown(state)),
    ]);
    return { artifact, solverView };
}

export async function buildFinalDepthReselection({ write = true } = {}) {
    const [
        catalog, official, baseline, pilot, rollout, deepArtifact, deepLog, deepStatuses,
        expansionPolicy, repositoryPolicy,
    ] = await Promise.all([
        readJson(path.join(ROOT, 'benchmarks/input_catalog.json')),
        readJson(path.join(ROOT, 'benchmarks/manifest.json')),
        readJson(path.join(ROOT, 'benchmarks/hard-53x1/v1/instances.json')),
        readJson(path.join(ROOT, 'benchmarks/diversity-pilot/v1/instances.json')),
        readJson(path.join(ROOT, 'benchmarks/hard-53x3-rollout/v1/instances.json')),
        readJson(path.join(ROOT, 'benchmarks/hard-53x3-deep-diversity/v1/instances.json')),
        readJson(path.join(ROOT, 'benchmarks/hard-53x3-deep-diversity/v1/candidate-log.json')),
        readJson(path.join(ROOT, 'benchmarks/hard-53x3-deep-diversity/v1/target-status.json')),
        readJson(path.join(ROOT, 'benchmarks/policy/input-environment-expansion.v1.json')),
        loadRepositoryPolicy(),
    ]);
    const frozenBefore = {
        baseline: artifactContentHash(baseline),
        pilot: artifactContentHash(pilot),
        rollout: artifactContentHash(rollout),
        deepArtifact: artifactContentHash(deepArtifact),
    };
    const compiled = compileCatalog(catalog);
    const targetById = new Map(official.cases.map(target => [target.id, target]));
    const baselineByTarget = new Map(baseline.instances.map(instance => [instance.targetId, instance]));
    const overlaysByTarget = new Map();
    for (const instance of [...pilot.instances, ...rollout.instances]) {
        const rows = overlaysByTarget.get(instance.targetId) ?? [];
        rows.push(instance);
        rows.sort((a, b) => a.id.localeCompare(b.id));
        overlaysByTarget.set(instance.targetId, rows);
    }
    const statusByTarget = new Map(deepStatuses.map(status => [status.targetId, status]));
    const committedAttemptByKey = new Map(deepLog.map(attempt => [`${attempt.targetId}:${attempt.candidate}`, attempt]));
    const recovered = await buildHard53x3DeepDiversity({
        write: false,
        targetIds: [...RESELECTION_TARGET_IDS, HARD_MAIN_010],
        retainCandidateInstances: true,
    });

    const instances = [];
    const reselection = [];
    const candidateLog = [];
    for (const targetId of RESELECTION_TARGET_IDS) {
        const source = baselineByTarget.get(targetId);
        const sourceReplay = replayWitness(source, catalog);
        const status = statusByTarget.get(targetId);
        const selectedNumber = RECOVERED_SELECTIONS[targetId];
        const targetAttempts = recovered.attempts.filter(attempt => attempt.targetId === targetId);
        for (const attempt of targetAttempts) {
            const committed = committedAttemptByKey.get(`${targetId}:${attempt.candidate}`);
            if (!committed) throw new Error(`${targetId} candidate ${attempt.candidate} was not in the existing funnel`);
            if (attempt.candidateSignature !== committed.candidateSignature
                || attempt.operationCount !== committed.operationCount) {
                throw new Error(`${targetId} candidate ${attempt.candidate} did not reproduce the committed funnel`);
            }
            let normalizedDepth = null;
            if (attempt.replayResult?.valid) {
                const replay = replayWitness(attempt.instance, catalog);
                normalizedDepth = classifyTargetRelativeDepth(source, sourceReplay, attempt.instance, replay);
            }
            candidateLog.push({
                targetId,
                originalCandidateId: attempt.candidate,
                macroPlanId: attempt.macroPlanId,
                macroClass: attempt.macroPlanClass,
                replayValid: Boolean(attempt.replayResult?.valid),
                expansionValid: Boolean(attempt.expansionResult?.valid),
                structuralNovel: attempt.candidateSignature !== status.baselineSignature,
                savedDepth: attempt.depthLevel ?? null,
                normalizedDepth: normalizedDepth?.level ?? null,
                rotationMaterialAlias: normalizedDepth?.rotationMaterialAlias ?? null,
                operationCount: attempt.operationCount ?? null,
                signature: attempt.candidateSignature ?? null,
                reason: attempt.reason,
            });
        }
        const selected = targetAttempts.find(attempt => attempt.candidate === selectedNumber);
        const committedSelected = committedAttemptByKey.get(`${targetId}:${selectedNumber}`);
        if (!selected?.instance || !selected.replayResult?.valid || !selected.expansionResult?.valid) {
            throw new Error(`${targetId}: recovered selection #${selectedNumber} is not replay/expansion valid`);
        }
        const replay = replayWitness(selected.instance, catalog);
        const expansion = validateExpansionMetadata(selected.instance, catalog, replay, expansionPolicy);
        if (!expansion.valid) throw new Error(`${targetId}: ${expansion.errors.join('; ')}`);
        const structural = deriveStructuralFingerprint(selected.instance, replay);
        const depth = classifyTargetRelativeDepth(source, sourceReplay, selected.instance, replay);
        if (!['C', 'D', 'E'].includes(depth.level)) throw new Error(`${targetId}: selected candidate collapsed to ${depth.level}`);
        if ([status.baselineSignature, status.retainedSignature, status.replacedSignature, status.newSignature]
            .includes(structural.signature)) {
            throw new Error(`${targetId}: selected candidate is not novel relative to frozen/rejected families`);
        }
        const instance = clone(selected.instance);
        instance.id = `${targetId}-final-depth-reselection`;
        instance.provenance = {
            ...instance.provenance,
            releaseId: FINAL_DEPTH_RESELECTION_RELEASE_ID,
            generatorVersion: `${FINAL_DEPTH_RESELECTION_VERSION}+recovered-deep-pass-candidate-${selectedNumber}+${TARGET_RELATIVE_DEPTH_POLICY_VERSION}`,
            generatorSourceSha256: await fileSha256('benchmarks/tools/build-final-depth-reselection.mjs'),
        };
        instance.instanceSha256 = instanceContentHash(instance);
        instances.push(instance);
        const oldAttempt = deepLog.find(attempt => attempt.targetId === targetId && attempt.accepted);
        const oldReason = ['hard-side-031', 'hard-side-035'].includes(targetId)
            ? `naturalness rejection: ${oldAttempt.operationCount} operations vs baseline ${source.difficulty.operationCount}`
            : 'rotation/material normalized depth collapsed to A/B';
        reselection.push({
            targetId,
            candidateRecovered: true,
            oldRejectedCandidate: oldAttempt.candidate,
            oldRejectedReason: oldReason,
            originalCandidateId: selectedNumber,
            macroPlanId: selected.macroPlanId,
            macroClass: selected.macroPlanClass,
            baselineSignature: status.baselineSignature,
            retainedBSignature: status.retainedSignature,
            rejectedStagedSignature: status.replacedSignature,
            rejectedDeepPassSignature: status.newSignature,
            newSignature: structural.signature,
            depth: depth.level,
            normalizedDepthEvidence: depth.normalizedEvidence,
            earliestDivergence: depth.earliestSubstantiveDivergence,
            rejoin: depth.rejoinPoint,
            baselineOperations: source.difficulty.operationCount,
            oldRejectedOperations: oldAttempt.operationCount,
            candidateOperations: instance.difficulty.operationCount,
            environment: selected.environment,
            replayValid: replay.valid,
            expansionValid: expansion.valid,
            structuralNovel: true,
            naturalnessAccepted: true,
            accepted: true,
            provenance: {
                funnelReleaseId: deepArtifact.releaseId,
                originalCandidateId: selectedNumber,
                originalCandidateSignature: committedSelected.candidateSignature,
                materializedReleaseId: FINAL_DEPTH_RESELECTION_RELEASE_ID,
            },
        });
    }

    const targetCase = targetById.get(HARD_MAIN_010);
    const source = baselineByTarget.get(HARD_MAIN_010);
    const overlays = overlaysByTarget.get(HARD_MAIN_010);
    const expansionPolicySha256 = await fileSha256('benchmarks/policy/input-environment-expansion.v1.json');
    const feasibilityPlans = [
        {
            id: 'removable-solid-mask-column-extraction-stacker',
            macroClass: 'sparse-removable-solid-mask',
            kind: 'removable-solid-mask-crystal',
            recomposition: 'stacker',
        },
        {
            id: 'removable-solid-mask-column-extraction-swapper',
            macroClass: 'sparse-removable-solid-mask-swapper-recomposition',
            kind: 'removable-solid-mask-crystal',
            recomposition: 'swapper',
        },
    ];
    const newFeasibility = [];
    for (const [index, macroPlan] of feasibilityPlans.entries()) {
        newFeasibility.push(await materializeFeasibilityCandidate({
            macroPlan,
            serial: index + 1,
            targetCase,
            source,
            catalog,
            compiled,
            expansionPolicy,
            expansionPolicySha256,
            repositoryPolicy,
            prior: [source, ...overlays],
        }));
    }
    const acceptedFeasibility = newFeasibility.find(candidate => ['C', 'D', 'E'].includes(candidate.depth.level));
    if (!acceptedFeasibility) throw new Error('hard-main-010 remained unresolved after sparse removable-mask coverage');
    acceptedFeasibility.instance.id = `${HARD_MAIN_010}-final-depth-feasibility`;
    acceptedFeasibility.instance.instanceSha256 = instanceContentHash(acceptedFeasibility.instance);
    instances.push(acceptedFeasibility.instance);

    const old010Attempts = recovered.attempts.filter(attempt => attempt.targetId === HARD_MAIN_010);
    const feasibilityLog = [
        ...old010Attempts.map(attempt => ({
            source: 'existing Deep Pass funnel',
            candidateId: attempt.candidate,
            macroPlanId: attempt.macroPlanId,
            macroClass: attempt.macroPlanClass,
            replayValid: Boolean(attempt.replayResult?.valid),
            normalizedDepth: null,
            operationCount: attempt.operationCount ?? null,
            reason: attempt.reason,
        })),
        ...newFeasibility.map((candidate, index) => ({
            source: 'targeted feasibility exploration',
            candidateId: old010Attempts.length + index + 1,
            macroPlanId: candidate.macroPlan.id,
            macroClass: candidate.macroPlan.macroClass,
            replayValid: candidate.replay.valid,
            expansionValid: true,
            structuralNovel: candidate.structural.signature !== source.diversity.structureSignature,
            normalizedDepth: candidate.depth.level,
            normalizedDepthEvidence: candidate.depth.normalizedEvidence,
            operationCount: candidate.instance.difficulty.operationCount,
            signature: candidate.structural.signature,
            reason: candidate.depth.rationale,
        })),
    ];
    candidateLog.push(...feasibilityLog.map(row => ({ targetId: HARD_MAIN_010, ...row })));
    const hardMain010 = {
        targetId: HARD_MAIN_010,
        macroClassesSearched: [...new Set(feasibilityLog.map(row => row.macroClass))],
        candidateCount: feasibilityLog.length,
        replayFailures: feasibilityLog.filter(row => !row.replayValid).length,
        shallowCollapses: feasibilityLog.filter(row => ['A', 'B'].includes(row.normalizedDepth)).length,
        deepCandidates: feasibilityLog.filter(row => ['C', 'D', 'E'].includes(row.normalizedDepth)).length,
        finalClassification: 'DEEP_ROUTE_FOUND',
        accepted: {
            signature: acceptedFeasibility.structural.signature,
            depth: acceptedFeasibility.depth.level,
            macroTopology: acceptedFeasibility.macroPlan.macroClass,
            operationCount: acceptedFeasibility.instance.difficulty.operationCount,
            baselineOperationCount: source.difficulty.operationCount,
            earliestDivergence: acceptedFeasibility.depth.earliestSubstantiveDivergence,
            rejoin: acceptedFeasibility.depth.rejoinPoint,
            normalizedDepthEvidence: acceptedFeasibility.depth.normalizedEvidence,
            environmentProfile: acceptedFeasibility.environment,
        },
        attempts: feasibilityLog,
    };

    const frozenAfter = {
        baseline: artifactContentHash(baseline),
        pilot: artifactContentHash(pilot),
        rollout: artifactContentHash(rollout),
        deepArtifact: artifactContentHash(deepArtifact),
    };
    const integrity = {
        baselineUnchanged: frozenBefore.baseline === frozenAfter.baseline,
        existingAcceptedCandidateArtifactsUnchanged: frozenBefore.deepArtifact === frozenAfter.deepArtifact,
        pilotUnchanged: frozenBefore.pilot === frozenAfter.pilot,
        rolloutUnchanged: frozenBefore.rollout === frozenAfter.rollout,
        structuralCanonicalizationChanged: false,
        schemaOrValidatorChanged: false,
        compositeReleaseConstructed: false,
        solverFilteringUsed: false,
        generated53x5: false,
        insaneTouched: false,
    };
    if (!Object.entries(integrity).every(([key, value]) => key.endsWith('Changed') ? value === false : key.endsWith('Constructed') || key.endsWith('Used') || key.endsWith('Touched') || key === 'generated53x5' ? value === false : value === true)) {
        throw new Error('final depth re-selection integrity assertion failed');
    }
    const statistics = {
        reselection: {
            replacementsFound: reselection.filter(row => row.accepted).length,
            remainingGaps: reselection.filter(row => !row.accepted).length,
            depthDistribution: countBy(reselection.filter(row => row.accepted), row => row.depth),
        },
        hardMain010: {
            finalClassification: hardMain010.finalClassification,
            candidateCount: hardMain010.candidateCount,
            replayFailures: hardMain010.replayFailures,
            shallowCollapses: hardMain010.shallowCollapses,
            deepCandidates: hardMain010.deepCandidates,
        },
        acceptedBefore: { required: 14, optionalPromotions: 16, total: 30 },
        proposedReplacementTotal: 30 + reselection.length + 1,
        recommendation: reselection.length === 11 && hardMain010.finalClassification === 'DEEP_ROUTE_FOUND'
            ? 'READY FOR FINAL TARGETED ACCEPTANCE' : 'SMALL GAP REMAINS',
    };
    const state = { instances, reselection, candidateLog, hardMain010, statistics, integrity };
    const directory = path.join(ROOT, 'benchmarks/final-depth-reselection/v1');
    const output = write ? await writeOutputs(directory, state) : null;
    return { ...state, ...output };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const result = await buildFinalDepthReselection();
    console.log(JSON.stringify({
        reselection: result.statistics.reselection,
        hardMain010: result.statistics.hardMain010,
        proposedReplacementTotal: result.statistics.proposedReplacementTotal,
        recommendation: result.statistics.recommendation,
    }, null, 2));
}
