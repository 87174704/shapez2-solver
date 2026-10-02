import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildPilot, selectRefinementBundle } from '../benchmarks/tools/build-pilot.mjs';
import { auditPilot } from '../benchmarks/tools/audit-pilot.mjs';
import { buildCoveragePilot } from '../benchmarks/tools/build-coverage-pilot.mjs';
import { buildExpansionPilot } from '../benchmarks/tools/build-expansion-pilot.mjs';
import { buildHard53x1, previewDirectLayerComposition } from '../benchmarks/tools/build-hard-53x1.mjs';
import {
    buildHard53x3DiversityPilot, DIVERSITY_PILOT_TARGET_IDS,
} from '../benchmarks/tools/build-hard-53x3-diversity-pilot.mjs';
import { buildHard53x3Rollout } from '../benchmarks/tools/build-hard-53x3-rollout.mjs';
import { auditHard53x3StagedComposition } from '../benchmarks/tools/audit-hard-53x3-staged-composition.mjs';
import {
    artifactContentHash, artifactInstancesHash, canonicalMultiset, classifyTargetRefinement, compileCatalog, deriveMetadata,
    deriveStructuralFingerprint, instanceContentHash, replayWitness, sha256,
    validateExpansionMetadata, validateInputRules,
} from '../benchmarks/tools/benchmark-core.mjs';
import { validateBenchmarkArtifact, validateBenchmarkRelease } from '../benchmarks/tools/validate-benchmark.mjs';
import { createBenchmarkSchemaValidator } from '../benchmarks/tools/schema-validation.mjs';
import {
    consolidateAvailableInputs, OrdinaryAtomAllocator, WitnessBuilder,
} from '../benchmarks/tools/generation-framework.mjs';
import { buildPinSubassembly, planPinSubassembly } from '../benchmarks/tools/pin-construction-planner.mjs';
import {
    buildCrystalSubassembly, planCrystalSubassembly, validateSparseUpperMaskPlan,
    validateStagedRefinementMaskPlan,
} from '../benchmarks/tools/crystal-construction-planner.mjs';
import {
    planMixedPinCrystalSubassembly, validateMixedPinCrystalPlan,
} from '../benchmarks/tools/mixed-pin-crystal-construction-planner.mjs';
import {
    Shape, ShapeOperationConfig, cut, genCrystal, halfCut, pushPin, stack,
} from '../shapeOperations.js';

const clone = value => structuredClone(value);
const RULES = Object.freeze({ maxLayers: 4, cleanPainting: true, allowSplitting: false });
const PILOT_MANIFEST_REVISION = 'hard-pilot-audit-v2-manifest-r2';
const COVERAGE_MANIFEST_REVISION = 'hard-coverage-pilot-v1-manifest-r2';
const EXPANSION_MANIFEST_REVISION = 'hard-expansion-pilot-v1-manifest-r2';
const HARD_53X1_MANIFEST_REVISION = 'hard-53x1-stage-v1-manifest-r2';
const HARD_53X3_PILOT_MANIFEST_REVISION = 'hard-53x3-diversity-pilot-v1-manifest-r1';
const HARD_53X3_ROLLOUT_MANIFEST_REVISION = 'hard-53x3-rollout-stage-v1-manifest-r1';

function relabelWitness(witness, offset = 1000) {
    const result = clone(witness);
    result.initial.forEach(token => { token.id += offset; });
    result.steps.forEach(step => {
        step.inputs = step.inputs.map(id => id + offset);
        step.outputs.forEach(output => { output.id += offset; });
    });
    result.resultId += offset;
    return result;
}

function refreshArtifactSelfHashes(artifact) {
    for (const instance of artifact.instances) instance.instanceSha256 = instanceContentHash(instance);
    artifact.sha256 = artifactInstancesHash(artifact.instances);
}

function fingerprintAfterReplay(instance, catalog) {
    const replay = replayWitness(instance, catalog);
    assert.equal(replay.valid, true, replay.errors?.join('\n'));
    return deriveStructuralFingerprint(instance, replay);
}

function reverseObjectKeyOrder(value) {
    if (Array.isArray(value)) return value.map(reverseObjectKeyOrder);
    if (value === null || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).reverse()
        .map(([key, child]) => [key, reverseObjectKeyOrder(child)]));
}

test('pilot generation is deterministic and the committed artifact independently validates', async () => {
    const generated = await buildPilot({ write: false });
    const committed = JSON.parse(await readFile(new URL('../benchmarks/pilot/v1/instances.json', import.meta.url), 'utf8'));
    assert.equal(generated.artifact.sha256, committed.sha256);
    assert.equal(committed.acceptedCount, 25);
    assert.deepEqual(committed.targetIds.map(id => committed.instances.filter(instance => instance.targetId === id).length), [5, 5, 5, 5, 5]);
    const validation = await validateBenchmarkArtifact();
    assert.equal(validation.valid, true, validation.errors.join('\n'));
    assert.equal(validation.summary.mechanicallyReplayed, 25);
});

test('causal pilot audit preserves witnesses and retains distinct resource ancestry', async () => {
    const { artifact, familySummary } = await auditPilot({ write: false });
    assert.equal(artifact.acceptedCount, 25);
    assert.deepEqual(familySummary.map(item => item.distinctStructuralFamilies), [5, 5, 5, 5, 5]);
    assert.equal(familySummary.flatMap(item => item.duplicateInstances).length, 0);
    const legacy = JSON.parse(await readFile(new URL('../benchmarks/pilot/v1/instances.json', import.meta.url), 'utf8'));
    for (const [index, instance] of artifact.instances.entries()) {
        assert.deepEqual(instance.inputs, legacy.instances[index].inputs);
        assert.deepEqual(instance.witness, legacy.instances[index].witness);
    }
});

test('Hard 53x3 diversity pilot preserves the frozen baseline and adds two real families per selected target', async () => {
    const generated = await buildHard53x3DiversityPilot({ write: false });
    const committed = JSON.parse(await readFile(new URL('../benchmarks/diversity-pilot/v1/instances.json', import.meta.url), 'utf8'));
    const baseline = JSON.parse(await readFile(new URL('../benchmarks/hard-53x1/v1/instances.json', import.meta.url), 'utf8'));
    const baselineProjection = JSON.parse(await readFile(new URL('../benchmarks/hard-53x1/v1/solver-inputs.json', import.meta.url), 'utf8'));
    const catalog = JSON.parse(await readFile(new URL('../benchmarks/input_catalog.json', import.meta.url), 'utf8'));

    assert.deepEqual(generated.artifact, committed);
    assert.equal(artifactContentHash(baseline), '11005e04e359fff9d0d3a0fec66dd491ca8e441f5c5c880e1ff3441b9fc77da3');
    assert.equal(baseline.sha256, '40c4ea586dfeafb5f5e37545101220451d2cc9a9ca2ab54eb9d00a94806c8375');
    assert.equal(artifactContentHash(baselineProjection), '52b07a352c8da0215bd4e052c08262b2255aa094d1cddd9635a75f5ea68bf15a');
    assert.equal(committed.acceptedCount, DIVERSITY_PILOT_TARGET_IDS.length * 2);
    assert.equal(generated.status.every(item => item.familyCoverage === '3/3'), true);
    assert.ok(generated.attempts.filter(item => item.category === 'structural duplicate collapse').length > 0);

    for (const targetId of DIVERSITY_PILOT_TARGET_IDS) {
        const family1 = baseline.instances.find(instance => instance.targetId === targetId);
        const additions = committed.instances.filter(instance => instance.targetId === targetId);
        assert.equal(additions.length, 2);
        const familySignatures = new Set([family1.diversity.structureSignature]);
        const environmentSignatures = new Set([canonicalMultiset(family1.availableInputs)]);
        for (const instance of additions) {
            const replay = replayWitness(instance, catalog);
            assert.equal(replay.valid, true, `${targetId}: ${replay.errors?.join('\n')}`);
            const structural = deriveStructuralFingerprint(instance, replay);
            assert.equal(structural.signature, instance.diversity.structureSignature);
            familySignatures.add(structural.signature);
            environmentSignatures.add(canonicalMultiset(instance.availableInputs));
            assert.equal(instance.expansion.kind, 'transformative');
            assert.equal(instance.expansion.sourceInstance.releaseId, baseline.releaseId);
            assert.equal(instance.expansion.sourceInstance.id, family1.id);
            assert.equal(instance.expansion.sourceInstance.instanceSha256, family1.instanceSha256);
        }
        assert.equal(familySignatures.size, 3, `${targetId}: structural families`);
        assert.equal(environmentSignatures.size, 3, `${targetId}: presented environments`);
    }

    const publicProjection = generated.solverView;
    assert.deepEqual(publicProjection.instances.map(instance => Object.keys(instance).sort()),
        publicProjection.instances.map(() => ['availableInputs', 'id', 'rules', 'target', 'targetId', 'track']));
    const pilotValidation = await validateBenchmarkArtifact({ releaseId: HARD_53X3_PILOT_MANIFEST_REVISION });
    assert.equal(pilotValidation.valid, true, pilotValidation.errors.join('\n'));
    assert.equal(pilotValidation.summary.releaseAcceptance, true);
    const baselineValidation = await validateBenchmarkArtifact({ releaseId: HARD_53X1_MANIFEST_REVISION });
    assert.equal(baselineValidation.valid, true, baselineValidation.errors.join('\n'));
    assert.equal(baselineValidation.summary.mechanicallyReplayed, 53);
});

test('Hard 53x3 rollout mechanically subtracts the pilot and fills the remaining forty targets', async () => {
    const generated = await buildHard53x3Rollout({ write: false });
    const committed = JSON.parse(await readFile(new URL('../benchmarks/hard-53x3-rollout/v1/instances.json', import.meta.url), 'utf8'));
    const baseline = JSON.parse(await readFile(new URL('../benchmarks/hard-53x1/v1/instances.json', import.meta.url), 'utf8'));
    const pilot = JSON.parse(await readFile(new URL('../benchmarks/diversity-pilot/v1/instances.json', import.meta.url), 'utf8'));

    assert.deepEqual(generated.artifact, committed);
    assert.equal(generated.remainingTargetIds.length, 40);
    assert.equal(generated.remainingTargetIds.some(id => pilot.targetIds.includes(id)), false);
    assert.equal(generated.status.every(item => item.familyCoverage === '3/3'), true);
    assert.equal(generated.checkpoints.length, 5);
    assert.deepEqual(generated.checkpoints.map(item => item.targetsAttempted.length), [8, 8, 8, 8, 8]);
    assert.equal(committed.acceptedCount, 80);
    assert.equal(committed.instances.every(instance => instance.expansion.sourceInstance.releaseId === baseline.releaseId), true);

    const difficult = generated.status.find(item => item.targetId === 'hard-main-009');
    assert.equal(difficult.acceptedFamilies.length, 2);
    assert.equal(difficult.acceptedFamilies.every(item => item.diversityDepth === 'preprocessing topology'), true);
    assert.equal(difficult.acceptedFamilies.every(item => item.replacementTopology[0].presentedInputs.length === 2), true);

    for (const targetId of generated.remainingTargetIds) {
        const signatures = new Set([
            baseline.instances.find(instance => instance.targetId === targetId).diversity.structureSignature,
            ...committed.instances.filter(instance => instance.targetId === targetId)
                .map(instance => instance.diversity.structureSignature),
        ]);
        assert.equal(signatures.size, 3, `${targetId}: structural families`);
    }
    const validation = await validateBenchmarkArtifact({ releaseId: HARD_53X3_ROLLOUT_MANIFEST_REVISION });
    assert.equal(validation.valid, true, validation.errors.join('\n'));
    assert.equal(validation.summary.mechanicallyReplayed, 80);
    assert.equal(validation.summary.structuralFamilies, 80);
    assert.equal(validation.summary.releaseAcceptance, true);
});

test('Hard 53x3 staged composition preserves all source identities and isolates its public projection', async () => {
    const { composition, projection, statistics } = await auditHard53x3StagedComposition({ write: false });
    assert.equal(composition.errors.length, 0);
    assert.equal(composition.instanceCount, 159);
    assert.equal(composition.targetCount, 53);
    assert.equal(composition.targetsAt3of3, 53);
    assert.equal(composition.mechanicallyReplayed, 159);
    assert.equal(composition.expansionValidated, 159);
    assert.equal(composition.formalReleaseConstructed, false);
    assert.equal(composition.status, 'complete-but-release-blocked');
    assert.equal(new Set(composition.targetRows.flatMap(row => row.instanceIds)).size, 159);
    assert.equal(statistics.candidateFunnel.accepted, 106);
    assert.equal(statistics.diversityDepth.assemblyTopology, 0);
    assert.deepEqual(projection.instances.map(instance => Object.keys(instance).sort()),
        projection.instances.map(() => ['availableInputs', 'id', 'rules', 'target', 'targetId', 'track']));
    assert.equal(projection.instances.every(instance => /^h53-[0-9a-f]{20}$/.test(instance.id)), true);
});

test('coverage pilot deterministically forward-replays main, B/C/D, Pin, Crystal and reuse capabilities', async () => {
    const generated = await buildCoveragePilot({ write: false });
    const committed = JSON.parse(await readFile(new URL('../benchmarks/coverage-pilot/v1/instances.json', import.meta.url), 'utf8'));
    assert.equal(generated.artifact.sha256, committed.sha256);
    assert.equal(generated.artifact.acceptedCount, 5);
    assert.ok(generated.artifact.instances.some(instance => instance.track === 'main'));
    assert.deepEqual(new Set(generated.artifact.instances.map(instance => instance.difficulty.refinementGroup).filter(Boolean)), new Set(['B', 'C', 'D']));
    assert.ok(generated.artifact.instances.some(instance => (instance.difficulty.operationCounts['Pin Pusher'] ?? 0) > 0));
    assert.ok(generated.artifact.instances.some(instance => (instance.difficulty.operationCounts['Crystal Generator'] ?? 0) > 0));
    const validation = await validateBenchmarkArtifact({ releaseId: COVERAGE_MANIFEST_REVISION });
    assert.equal(validation.valid, true, validation.errors.join('\n'));
    assert.equal(validation.summary.mechanicallyReplayed, 5);
});

test('expansion pilot separates proof basis from two distinct presented environments and replays all six', async () => {
    const generated = await buildExpansionPilot({ write: false });
    const committed = JSON.parse(await readFile(new URL('../benchmarks/expansion-pilot/v1/instances.json', import.meta.url), 'utf8'));
    assert.equal(generated.artifact.sha256, committed.sha256);
    assert.equal(generated.artifact.acceptedCount, 6);
    assert.equal(generated.artifact.instances.filter(instance => instance.expansion.kind === 'additive').length, 4);
    assert.equal(generated.artifact.instances.filter(instance => instance.expansion.kind === 'transformative').length, 2);
    for (const targetId of generated.artifact.targetIds) {
        const environments = generated.artifact.instances.filter(instance => instance.targetId === targetId)
            .map(instance => instance.diversity.inputMultisetSignature);
        assert.equal(environments.length, 2);
        assert.equal(new Set(environments).size, 2);
    }
    assert.ok(generated.artifact.instances.some(instance => (instance.difficulty.operationCounts['Pin Pusher'] ?? 0) > 0));
    assert.ok(generated.artifact.instances.some(instance => (instance.difficulty.operationCounts['Crystal Generator'] ?? 0) > 0));
    assert.ok(generated.artifact.instances.every(instance => instance.difficulty.inputMultiplicity > instance.difficulty.coreInputMultiplicity));
    const validation = await validateBenchmarkArtifact({ releaseId: EXPANSION_MANIFEST_REVISION });
    assert.equal(validation.valid, true, validation.errors.join('\n'));
    assert.equal(validation.summary.mechanicallyReplayed, 6);
});

test('Hard 53x1 staged generation covers every target and release-validates every success', async () => {
    const generated = await buildHard53x1({ write: false });
    const committed = JSON.parse(await readFile(new URL('../benchmarks/hard-53x1/v1/instances.json', import.meta.url), 'utf8'));
    assert.equal(generated.status.length, 53);
    assert.equal(generated.artifact.acceptedCount, 53);
    assert.equal(generated.status.filter(item => item.generated).length, 53);
    assert.equal(generated.status.filter(item => !item.generated).length, 0);
    const finalStatus = generated.status.find(item => item.targetId === 'hard-side-033');
    assert.equal(finalStatus.rejectionCount, 1);
    assert.equal(finalStatus.forwardReplayPassed, true);
    assert.ok(finalStatus.availableInputCount > finalStatus.coreBasisCount);
    assert.deepEqual(
        generated.attempts.filter(attempt => attempt.targetId === 'hard-side-033').map(attempt => attempt.accepted),
        [false, true, true],
    );
    assert.equal(
        generated.coreArtifact.instances.find(instance => instance.targetId === 'hard-side-033').construction.strategy,
        'generic-crystal-single-color-half-scaffold',
    );
    assert.equal(generated.artifact.sha256, committed.sha256);
    assert.ok(generated.status.filter(item => !item.generated).every(item => item.failureReason && item.failureDetail));
    assert.ok(generated.artifact.instances.every(instance => instance.difficulty.inputMultiplicity > instance.difficulty.coreInputMultiplicity));
    const validation = await validateBenchmarkArtifact({ releaseId: HARD_53X1_MANIFEST_REVISION });
    assert.equal(validation.valid, true, validation.errors.join('\n'));
    assert.equal(validation.summary.mechanicallyReplayed, 53);
    assert.equal(validation.summary.releaseAcceptance, true);
});

test('Solver evaluation view excludes core basis, witness and expansion provenance', async () => {
    const { solverView } = await buildExpansionPilot({ write: false });
    for (const instance of solverView.instances) {
        assert.ok(Array.isArray(instance.availableInputs));
        assert.equal('coreWitnessBasis' in instance, false);
        assert.equal('witness' in instance, false);
        assert.equal('expansion' in instance, false);
        assert.equal('construction' in instance, false);
    }
});

test('expansion validation rejects missing presented resources, hidden core use, invalid bridges and false deltas', async () => {
    const { artifact } = await buildExpansionPilot({ write: false });
    const catalog = JSON.parse(await readFile(new URL('../benchmarks/input_catalog.json', import.meta.url), 'utf8'));
    const source = artifact.instances.find(instance => instance.expansion.kind === 'transformative');

    const insufficient = clone(source);
    insufficient.availableInputs = insufficient.availableInputs.filter(input => input.shape !== source.witness.initial[0].shape);
    assert.match(replayWitness(insufficient, catalog).errors.join('|'), /only x0 is available/);

    const hiddenCore = clone(source);
    hiddenCore.witness.initial[0].shape = source.expansion.basisRemoved[0].shape;
    assert.match(replayWitness(hiddenCore, catalog).errors.join('|'), /only x0 is available/);

    const falseBoundary = clone(source);
    falseBoundary.expansion.preprocessingStepCount = 0;
    const falseBoundaryReplay = replayWitness(falseBoundary, catalog);
    assert.match(validateExpansionMetadata(falseBoundary, catalog, falseBoundaryReplay).errors.join('|'), /transformative expansion.*preprocessing|bridge tokens/);

    const falseBridge = clone(source);
    falseBridge.expansion.bridgeTokenIds[0] = falseBridge.witness.steps[0].outputs.find(output => output.shape !== source.expansion.basisRemoved[0].shape).id;
    const falseBridgeReplay = replayWitness(falseBridge, catalog);
    assert.match(validateExpansionMetadata(falseBridge, catalog, falseBridgeReplay).errors.join('|'), /bridge tokens do not exactly reconstruct/);

    const falseDelta = clone(source);
    falseDelta.expansion.availableAdded[0].count += 1;
    const falseDeltaReplay = replayWitness(falseDelta, catalog);
    assert.match(validateExpansionMetadata(falseDelta, catalog, falseDeltaReplay).errors.join('|'), /availableAdded does not match/);
});

test('expanded presented environments still enforce multiplicity and exact refinement bundles', async () => {
    const { artifact } = await buildExpansionPilot({ write: false });
    const catalog = JSON.parse(await readFile(new URL('../benchmarks/input_catalog.json', import.meta.url), 'utf8'));
    const ordinary = clone(artifact.instances.find(instance => instance.targetId === 'hard-main-004'));
    ordinary.availableInputs.find(input => input.shape === 'RuCuWuCu').count = 4;
    assert.match(replayWitness(ordinary, catalog).errors.join('|'), /exceeds multiplicity 3/);

    const refinement = clone(artifact.instances.find(instance => instance.targetId === 'hard-main-010'));
    refinement.availableInputs = refinement.availableInputs.filter(input => input.shape !== 'XmXmXmXm');
    assert.match(replayWitness(refinement, catalog).errors.join('|'), /requires XmXmXmXm x1, found x0/);
});

test('expansion policy enforces maximumAddedOrdinaryMultiplicity as a total delta count', async () => {
    const { artifact } = await buildExpansionPilot({ write: false });
    const [catalog, expansionPolicy] = await Promise.all([
        readFile(new URL('../benchmarks/input_catalog.json', import.meta.url), 'utf8').then(JSON.parse),
        readFile(new URL('../benchmarks/policy/input-environment-expansion.v1.json', import.meta.url), 'utf8').then(JSON.parse),
    ]);
    const instance = clone(artifact.instances.find(candidate => candidate.id === 'hard-main-004-expansion-01'));
    instance.availableInputs.push({ shape: 'WuCu----', count: 2 });
    instance.expansion.availableAdded.push({ shape: 'WuCu----', count: 2 });
    const replay = replayWitness(instance, catalog);
    assert.equal(replay.valid, true, replay.errors?.join('\n'));
    const validation = validateExpansionMetadata(instance, catalog, replay, expansionPolicy);
    assert.match(validation.errors.join('|'), /adds 4 ordinary occurrences.*total added ordinary limit 3/);
});

test('input rules reject excluded, over-multiplicity, special-main and incomplete refinement inputs', async () => {
    const { catalog, artifact } = await buildPilot({ write: false });
    const ordinary = clone(artifact.instances.find(instance => instance.targetId === 'hard-side-006'));
    ordinary.inputs = [{ shape: 'WuWuWuWu', count: 1 }];
    assert.match(validateInputRules(ordinary, catalog).errors.join('|'), /excluded input/);

    const repeated = clone(artifact.instances.find(instance => instance.targetId === 'hard-side-006'));
    repeated.inputs[0].count = 4;
    assert.match(validateInputRules(repeated, catalog).errors.join('|'), /exceeds multiplicity 3/);

    const main = clone(artifact.instances.find(instance => instance.targetId === 'hard-side-006'));
    main.track = 'main'; main.inputs = [{ shape: 'SuSuRuRu', count: 1 }];
    assert.match(validateInputRules(main, catalog).errors.join('|'), /forbidden for main/);

    const refinement = clone(artifact.instances.find(instance => instance.targetId === 'hard-side-035'));
    refinement.inputs = refinement.inputs.filter(input => input.shape !== 'XgXgXgXg');
    assert.match(validateInputRules(refinement, catalog).errors.join('|'), /requires XgXgXgXg x1, found x0/);

    const mixedGroupTarget = clone(refinement);
    mixedGroupTarget.target = 'XwYk----';
    assert.match(validateInputRules(mixedGroupTarget, catalog).errors.join('|'), /multiple refinement groups/);
});

test('refinement classification preserves module type and selects exactly one generator bundle', async () => {
    const [catalog, manifest] = await Promise.all([
        readFile(new URL('../benchmarks/input_catalog.json', import.meta.url), 'utf8').then(JSON.parse),
        readFile(new URL('../benchmarks/manifest.json', import.meta.url), 'utf8').then(JSON.parse),
    ]);
    const compiled = compileCatalog(catalog);
    const cases = [
        ['Xr------', 'A', [{ shape: 'XrXrXrXr', count: 1 }, { shape: 'XgXgXgXg', count: 1 }, { shape: 'XbXbXbXb', count: 1 }]],
        ['Xc------', 'B', [{ shape: 'XcXcXcXc', count: 1 }, { shape: 'XmXmXmXm', count: 1 }, { shape: 'XyXyXyXy', count: 1 }]],
        ['Xk------', 'C', [{ shape: 'XwXwXwXw', count: 1 }, { shape: 'XkXkXkXk', count: 1 }]],
        ['Yk------', 'D', [{ shape: 'YkYkYwYw', count: 2 }]],
        ['RuCuWuCu', null, []],
    ];
    const bundles = new Map(cases.filter(([, group]) => group).map(([, group, inputs]) => [group, inputs]));
    for (const [target, expectedGroup, expectedInputs] of cases) {
        assert.equal(classifyTargetRefinement(target, compiled).group, expectedGroup, target);
        assert.deepEqual(selectRefinementBundle(target, catalog).inputs, expectedInputs, target);

        const correct = { track: 'side', target, inputs: expectedInputs };
        assert.equal(validateInputRules(correct, catalog).valid, true, `${target}: correct bundle`);

        const wrongGroup = expectedGroup === 'A' ? 'B' : 'A';
        const wrong = { ...correct, inputs: bundles.get(wrongGroup) };
        assert.equal(validateInputRules(wrong, catalog).valid, false, `${target}: wrong ${wrongGroup} bundle`);
    }

    const hardMain012 = manifest.cases.find(item => item.id === 'hard-main-012');
    assert.ok(hardMain012);
    const classification = classifyTargetRefinement(hardMain012.target, compiled);
    assert.equal(classification.group, 'D');
    assert.deepEqual([...classification.features].sort(), ['Yk', 'Yw']);

    const bundle = selectRefinementBundle(hardMain012.target, catalog);
    assert.equal(bundle.group, 'D');
    assert.deepEqual(bundle.inputs, [{ shape: 'YkYkYwYw', count: 2 }]);

    const correct = { track: hardMain012.track, target: hardMain012.target, inputs: bundle.inputs };
    assert.equal(validateInputRules(correct, catalog).valid, true);
    const wrongC = {
        ...correct,
        inputs: [{ shape: 'XwXwXwXw', count: 1 }, { shape: 'XkXkXkXk', count: 1 }],
    };
    const wrongErrors = validateInputRules(wrongC, catalog).errors.join('|');
    assert.match(wrongErrors, /does not match target group D/);
    assert.match(wrongErrors, /refinement D requires YkYkYwYw x2, found x0/);

    assert.throws(
        () => classifyTargetRefinement('XwYk----', compiled),
        /multiple refinement groups: C, D/,
    );
    assert.throws(
        () => classifyTargetRefinement('Yr------', compiled),
        /refinement parts absent from catalog mapping: Yr/,
    );

    const overlappingCatalog = clone(catalog);
    overlappingCatalog.refinement.D.inputs['Xw------'] = 1;
    assert.throws(
        () => compileCatalog(overlappingCatalog),
        /refinement feature Xw belongs to multiple groups: C, D/,
    );
});

test('independent replay rejects forged lineage, operation output and final result', async () => {
    const { catalog, artifact } = await buildPilot({ write: false });
    const source = artifact.instances[0];
    const badInput = clone(source);
    badInput.witness.steps[0].inputs[0] = 999999;
    assert.equal(replayWitness(badInput, catalog).valid, false);

    const badOutput = clone(source);
    badOutput.witness.steps[0].outputs[0].shape = 'CuCuCuCu';
    assert.equal(replayWitness(badOutput, catalog).valid, false);

    const badResult = clone(source);
    badResult.witness.resultId = badResult.witness.initial[0].id;
    assert.equal(replayWitness(badResult, catalog).valid, false);
});

test('available inputs may be unselected, including refinement members', async () => {
    const { catalog } = await buildPilot({ write: false });
    const ordinary = {
        track: 'side', target: 'CuRuCuWu',
        inputs: [{ shape: 'RuCuWuCu', count: 1 }, { shape: 'CuCu----', count: 1 }],
        rules: { maxLayers: 4, cleanPainting: true, allowSplitting: false },
        witness: {
            initial: [{ id: 0, shape: 'RuCuWuCu' }],
            steps: [{
                operation: 'Rotator CW', inputs: [0], params: {},
                outputs: [{ id: 1, shape: 'CuRuCuWu' }],
            }],
            resultId: 1,
        },
    };
    const ordinaryReplay = replayWitness(ordinary, catalog);
    assert.equal(ordinaryReplay.valid, true, ordinaryReplay.errors?.join('\n'));
    assert.equal(ordinaryReplay.unusedAvailableInputCount, 1);
    assert.equal(ordinaryReplay.liveWasteCount, 0);

    const refinement = {
        track: 'side', target: 'XrXr----',
        inputs: [
            { shape: 'XrXrXrXr', count: 1 },
            { shape: 'XgXgXgXg', count: 1 },
            { shape: 'XbXbXbXb', count: 1 },
        ],
        rules: { maxLayers: 4, cleanPainting: true, allowSplitting: false },
        witness: {
            initial: [{ id: 0, shape: 'XrXrXrXr' }],
            steps: [{
                operation: 'Cutter', inputs: [0], params: {},
                outputs: [{ id: 1, shape: '----XrXr' }, { id: 2, shape: 'XrXr----' }],
            }],
            resultId: 2,
        },
    };
    const refinementReplay = replayWitness(refinement, catalog);
    assert.equal(refinementReplay.valid, true, refinementReplay.errors?.join('\n'));
    assert.equal(refinementReplay.targetGroup, 'A');
    assert.equal(refinementReplay.unusedAvailableInputCount, 2);

    const unavailable = clone(ordinary);
    unavailable.witness.initial.push({ id: 1, shape: 'SuSu--Su' });
    assert.match(replayWitness(unavailable, catalog).errors.join('|'), /only x0 is available/);
});

test('terminal operation byproducts may remain live', async () => {
    const { catalog } = await buildPilot({ write: false });
    const instance = {
        track: 'side', target: 'RuCu----', inputs: [{ shape: 'RuCuWuCu', count: 1 }],
        rules: { maxLayers: 4, cleanPainting: true, allowSplitting: false },
        witness: {
            initial: [{ id: 0, shape: 'RuCuWuCu' }],
            steps: [{
                operation: 'Cutter', inputs: [0], params: {},
                outputs: [{ id: 1, shape: '----WuCu' }, { id: 2, shape: 'RuCu----' }],
            }],
            resultId: 2,
        },
    };
    const replay = replayWitness(instance, catalog);
    assert.equal(replay.valid, true, replay.errors?.join('\n'));
    assert.equal(replay.liveWasteCount, 1);
});

test('canonical shape operations pin representative Pin, Crystal, gravity and four-layer behavior', () => {
    const config = new ShapeOperationConfig(4);
    const code = shape => shape.toShapeCode();

    assert.deepEqual(pushPin(Shape.fromShapeCode('Cu--Ru--'), config).map(code), [
        'P---P---:Cu--Ru--',
    ]);
    assert.deepEqual(pushPin(Shape.fromShapeCode('CuCuCuCu:RuRuRuRu:SuSuSuSu:WuWuWuWu'), config).map(code), [
        'P-P-P-P-:CuCuCuCu:RuRuRuRu:SuSuSuSu',
    ]);
    assert.deepEqual(pushPin(Shape.fromShapeCode('CuCuCuCu:RuRuRuRu:cr------:cb------'), config).map(code), [
        'P-P-P-P-:CuCuCuCu:RuRuRuRu',
    ], 'overflow across a fused crystal boundary breaks the retained crystal component');

    assert.deepEqual(genCrystal(Shape.fromShapeCode('P---Cucr:--P-Ru--'), 'g', config).map(code), [
        'cgcgCucr:cgcgRucg',
    ], 'generator replaces pins and empties while preserving solids and existing crystals');
    assert.deepEqual(cut(Shape.fromShapeCode('crCuCucr:cgcgcgcg'), config).map(code), [
        '----Cu--', '--Cu----',
    ], 'cutting a fused crystal component removes the full connected component');
    assert.deepEqual(halfCut(Shape.fromShapeCode('----CuCu'), config).map(code), [
        '--------',
    ], 'Half Destroyer keeps the designated Cutter lane even when it is empty');

    assert.deepEqual(stack(Shape.fromShapeCode('Cu------'), Shape.fromShapeCode('--Ru----'), config).map(code), [
        'CuRu----',
    ], 'unsupported top groups fall to the lowest collision-free layer');
    assert.deepEqual(stack(
        Shape.fromShapeCode('CuCuCuCu:RuRuRuRu:SuSuSuSu:WuWuWuWu'),
        Shape.fromShapeCode('HuHuHuHu'),
        config,
    ).map(code), ['CuCuCuCu:RuRuRuRu:SuSuSuSu:WuWuWuWu'], 'stack overflow discards layers above the configured cap');
});

test('generic Pin planner forward-replays column, supported-region and isolated-Pin primitives', async () => {
    const catalog = JSON.parse(await readFile(new URL('../benchmarks/input_catalog.json', import.meta.url), 'utf8'));
    const cases = [
        ['Cu------:P-------:Ru------', 'pin-column-sequence', false],
        ['P-------:Ru------:Cu----Wu', 'pin-supported-upper-region', false],
        ['Cu------:P-------', 'pin-column-sequence', true],
    ];
    for (const [target, kind, needsDestructiveScaffold] of cases) {
        const builder = new WitnessBuilder(4);
        const allocator = new OrdinaryAtomAllocator(builder, catalog, { track: 'side' });
        const atom = (part, quadrant) => allocator.atom(part, quadrant);
        const { resultId, plan } = buildPinSubassembly(builder, target, {
            buildPart: atom,
            buildSacrificialPart: quadrant => atom({ shape: 'C', color: 'u' }, quadrant),
        });
        assert.equal(plan.kind, kind);
        assert.equal(builder.shape(resultId), target);
        const instance = {
            track: 'side', target, inputs: consolidateAvailableInputs(builder.initial), rules: RULES,
            witness: builder.witness(resultId),
        };
        const replay = replayWitness(instance, catalog);
        assert.equal(replay.valid, true, replay.errors?.join('\n'));
        if (needsDestructiveScaffold) {
            assert.ok(instance.witness.steps.some(step => step.operation === 'Crystal Generator'));
            assert.ok(instance.witness.steps.some(step => step.operation === 'Cutter'));
            assert.ok(instance.witness.steps.some(step => step.operation === 'Pin Pusher'));
            const fingerprint = deriveStructuralFingerprint(instance, replay);
            assert.match(fingerprint.canonical, /Crystal Generator/);
            assert.match(fingerprint.canonical, /Pin Pusher/);

            const unavailable = clone(instance);
            unavailable.inputs[0].count -= 1;
            if (unavailable.inputs[0].count === 0) unavailable.inputs.shift();
            const rejected = replayWitness(unavailable, catalog);
            assert.equal(rejected.valid, false);
            assert.match(rejected.errors.join('|'), /available|initial/i);
        }
    }
    assert.throws(
        () => planPinSubassembly('P-------:--------:--Cu----'),
        /Pin construction unsupported/,
        'unsupported raised geometry is rejected instead of assuming support',
    );
});

test('generic Crystal planner forward-replays scaffold extraction, deliberate breakage and Swapper recomposition', async () => {
    const catalog = JSON.parse(await readFile(new URL('../benchmarks/input_catalog.json', import.meta.url), 'utf8'));
    const cases = [
        ['crCwcrRw:CwcrCwcr:crCwcrCw:crcrcrcr', false],
        ['RyCyRyCy:Cr--Cr--:CwCwCwCw:cmcmcmcm', true],
        ['--Sg--Sg:--Wg--Wg:RrCrRrCr:cccccccc', true],
    ];
    for (const [target, needsBreakage] of cases) {
        const builder = new WitnessBuilder(4);
        const allocator = new OrdinaryAtomAllocator(builder, catalog, { track: 'side' });
        const atom = (part, quadrant) => allocator.atom(part, quadrant);
        const { resultId, plan } = buildCrystalSubassembly(builder, target, {
            buildPart: atom,
            buildSacrificialPart: quadrant => atom({ shape: 'C', color: 'u' }, quadrant),
        });
        assert.equal(plan.kind, 'single-color-half-scaffold');
        assert.equal(plan.usesDeliberateBreakage, needsBreakage);
        assert.equal(builder.shape(resultId), target);
        assert.equal(builder.steps.filter(step => step.operation === 'Crystal Generator').length, 2);
        assert.equal(builder.steps.filter(step => step.operation === 'Cutter').length >= 2, true);
        assert.equal(builder.steps.at(-1).operation, 'Swapper');
        const instance = {
            track: 'side', target, inputs: consolidateAvailableInputs(builder.initial), rules: RULES,
            witness: builder.witness(resultId),
        };
        const replay = replayWitness(instance, catalog);
        assert.equal(replay.valid, true, replay.errors?.join('\n'));
        const fingerprint = deriveStructuralFingerprint(instance, replay);
        assert.match(fingerprint.canonical, /Crystal Generator/);
        assert.match(fingerprint.canonical, /Swapper/);
    }
    assert.equal(
        planCrystalSubassembly('cycycycy:XkcwXk--:--Cy----').kind,
        'sparse-upper-refinement-mask',
    );
});

test('Crystal composition falls back from destructive dense-layer Stack to the existing half-scaffold planner', async () => {
    const target = 'RwcmRwcm:cmRwcmRw';
    assert.equal(
        previewDirectLayerComposition(target),
        'RwcmRwcm:--Rw--Rw',
        'detached upper Crystal cells shatter before the layer can settle',
    );

    const plan = planCrystalSubassembly(target);
    assert.equal(plan.kind, 'single-color-half-scaffold');
    assert.equal(plan.breakageCount, 0);

    const catalog = JSON.parse(await readFile(new URL('../benchmarks/input_catalog.json', import.meta.url), 'utf8'));
    const builder = new WitnessBuilder(4);
    const allocator = new OrdinaryAtomAllocator(builder, catalog, { track: 'side' });
    const atom = (part, quadrant) => allocator.atom(part, quadrant);
    const { resultId } = buildCrystalSubassembly(builder, target, {
        buildPart: atom,
        buildSacrificialPart: quadrant => atom({ shape: 'C', color: 'u' }, quadrant),
    });
    assert.equal(builder.shape(resultId), target);
    assert.equal(builder.steps.at(-1).operation, 'Swapper');

    const instance = {
        track: 'side', target, inputs: consolidateAvailableInputs(builder.initial), rules: RULES,
        witness: builder.witness(resultId),
    };
    assert.equal(replayWitness(instance, catalog).valid, true);
});

test('staged refinement-mask planner protects the first color, consumes a real Pin mask and rejects bad ordering or geometry', async () => {
    const catalog = JSON.parse(await readFile(new URL('../benchmarks/input_catalog.json', import.meta.url), 'utf8'));
    const target = 'cwRwcwcw:cwCwcwcw:cccccccc';
    const plan = planCrystalSubassembly(target);
    assert.equal(plan.kind, 'staged-full-layer-refinement-mask');
    assert.equal(plan.splitLayer, 2);
    assert.deepEqual(plan.stages.map(stage => stage.color), ['w', 'c']);
    assert.deepEqual(plan.stages[1].maskLayers, ['P-------']);
    assert.equal(plan.targetCrystalBreakageCount, 0);
    assert.equal(validateStagedRefinementMaskPlan(target, plan).valid, true);

    const builder = new WitnessBuilder(4);
    const allocator = new OrdinaryAtomAllocator(builder, catalog, { track: 'main' });
    const atom = (part, quadrant) => allocator.atom(part, quadrant);
    const { resultId } = buildCrystalSubassembly(builder, target, {
        buildPart: atom,
        buildSacrificialPart: quadrant => atom({ shape: 'C', color: 'u' }, quadrant),
    });
    const instance = {
        track: 'main', target, inputs: consolidateAvailableInputs(builder.initial), rules: RULES,
        witness: builder.witness(resultId),
    };
    const replay = replayWitness(instance, catalog);
    assert.equal(replay.valid, true, replay.errors?.join('\n'));
    assert.equal(replay.targetGroup, null);
    assert.ok(instance.inputs.every(input => input.count <= 3));
    assert.equal(instance.inputs.some(input => input.shape === 'SuSuRuRu'), false);

    const tokens = new Map(instance.witness.initial.map(token => [token.id, token.shape]));
    for (const step of instance.witness.steps) for (const output of step.outputs) tokens.set(output.id, output.shape);
    const generators = instance.witness.steps.filter(step => step.operation === 'Crystal Generator');
    const finalGenerator = generators.at(-1);
    assert.equal(tokens.get(finalGenerator.inputs[0]), 'cwRwcwcw:cwCwcwcw:P-------');
    assert.equal(finalGenerator.params.color, 'c');
    assert.equal(finalGenerator.outputs[0].shape, target);
    assert.ok(instance.witness.steps.some(step => step.operation === 'Cutter'));
    const pinStep = instance.witness.steps.find(step => step.operation === 'Pin Pusher');
    assert.ok(pinStep);
    assert.equal(tokens.get(pinStep.inputs[0]), 'cr------:cr------:cr------:cr------');
    assert.equal(pinStep.outputs[0].shape, 'P-------');
    assert.equal(target.includes('P-'), false);

    const reversed = clone(plan);
    reversed.stages[0].color = 'c';
    reversed.stages[1].color = 'w';
    const reversedValidation = validateStagedRefinementMaskPlan(target, reversed);
    assert.equal(reversedValidation.valid, false);
    assert.match(reversedValidation.errors.join('|'), /instead of/);

    const wrongMask = clone(plan);
    wrongMask.stages[1].maskLayers = ['Cu------'];
    const wrongMaskValidation = validateStagedRefinementMaskPlan(target, wrongMask);
    assert.equal(wrongMaskValidation.valid, false);
    assert.match(wrongMaskValidation.result, /:Cucccccc$/);

    const forgedOrder = clone(instance);
    forgedOrder.witness.steps.filter(step => step.operation === 'Crystal Generator').at(-1).params.color = 'w';
    assert.equal(replayWitness(forgedOrder, catalog).valid, false);

    const groupC = selectRefinementBundle('cycycycy:XkcwXk--:--Cy----', catalog);
    assert.equal(groupC.group, 'C');
    assert.deepEqual(groupC.inputs, [
        { shape: 'XwXwXwXw', count: 1 },
        { shape: 'XkXkXkXk', count: 1 },
    ]);
});

test('sparse upper mask removes physical masks before half recomposition and preserves exact Group C lineage', async () => {
    const target = 'cycycycy:XkcwXk--:--Cy----';
    const plan = planCrystalSubassembly(target);
    assert.equal(plan.kind, 'sparse-upper-refinement-mask');
    assert.equal(plan.refinementHalf, 'left');
    assert.equal(plan.targetCrystalBreakageCount, 0);
    assert.deepEqual(plan.refinementComponent.maskLayers, ['XkP-CuCu', 'P-CyCuP-']);
    assert.equal(plan.refinementComponent.expected, 'cycy----:Xkcw----:--Cy----');
    assert.equal(plan.otherComponent.expected, '----cycy:----Xk--');
    assert.equal(validateSparseUpperMaskPlan(target, plan).valid, true);

    const premature = genCrystal(
        Shape.fromShapeCode('cycycycy:Xk--Xk--:--Cy----'), 'w', new ShapeOperationConfig(4),
    )[0].toShapeCode();
    assert.notEqual(premature, target);
    assert.equal(premature, 'cycycycy:XkcwXkcw:cwCycwcw');

    const attachedAfterRemoval = stack(
        Shape.fromShapeCode('cycycycy'),
        Shape.fromShapeCode('XkcwXk--:--Cy----'),
        new ShapeOperationConfig(4),
    )[0].toShapeCode();
    assert.notEqual(attachedAfterRemoval, target);
    assert.equal(attachedAfterRemoval, 'cycycycy:XkCyXk--');

    const wrongOrder = clone(plan);
    wrongOrder.refinementColor = plan.baseColor;
    assert.equal(validateSparseUpperMaskPlan(target, wrongOrder).valid, false);

    const detachedMask = stack(
        Shape.fromShapeCode(plan.refinementComponent.maskLayers[0]),
        Shape.fromShapeCode(plan.refinementComponent.maskLayers[1]),
        new ShapeOperationConfig(4),
    )[0];
    const refinedBeforeAttachment = genCrystal(detachedMask, plan.refinementColor, new ShapeOperationConfig(4))[0];
    const wrongStageOrder = stack(
        Shape.fromShapeCode(plan.refinementComponent.baseScaffold),
        refinedBeforeAttachment,
        new ShapeOperationConfig(4),
    )[0].toShapeCode();
    assert.notEqual(wrongStageOrder, 'cycyCuCu:XkcwCuCu:cwCyCucw');

    const missingPhysicalMask = clone(plan);
    missingPhysicalMask.refinementComponent.maskLayers[1] = 'P-CyCuCu';
    assert.equal(validateSparseUpperMaskPlan(target, missingPhysicalMask).valid, false);

    const { artifact, attempts, status } = await buildHard53x1({ write: false });
    const instance = artifact.instances.find(candidate => candidate.targetId === 'hard-side-040');
    assert.ok(instance);
    assert.equal(status.find(candidate => candidate.targetId === 'hard-side-040').rejectionCount, 1);
    assert.deepEqual(
        attempts.filter(attempt => attempt.targetId === 'hard-side-040').map(attempt => attempt.accepted),
        [false, true, true],
    );
    const catalog = JSON.parse(await readFile(new URL('../benchmarks/input_catalog.json', import.meta.url), 'utf8'));
    const replay = replayWitness(instance, catalog);
    assert.equal(replay.valid, true, replay.errors?.join('\n'));
    assert.equal(instance.witness.initial.filter(token => token.shape === 'XkXkXkXk').length, 1);
    assert.equal(instance.witness.initial.filter(token => token.shape === 'XwXwXwXw').length, 1);
    assert.ok(instance.witness.steps.some(step => step.operation === 'Pin Pusher'));
    assert.ok(instance.witness.steps.some(step => step.operation === 'Cutter'
        && step.outputs.some(output => output.shape === plan.refinementComponent.expected)));
    assert.equal(instance.witness.steps.at(-1).operation, 'Swapper');
    assert.ok(instance.witness.steps.at(-1).outputs.some(output => output.shape === target));

    const duplicateRefinement = clone(instance);
    duplicateRefinement.availableInputs.find(input => input.shape === 'XkXkXkXk').count = 2;
    const rejected = replayWitness(duplicateRefinement, catalog);
    assert.equal(rejected.valid, false);
    assert.match(rejected.errors.join('|'), /requires XkXkXkXk x1, found x2/);
});

test('mixed Pin/Crystal planner preserves ordered generation, Pin support, gravity and resource provenance', async () => {
    const targets = new Map([
        ['hard-main-007', 'WwcbWwcb:P-cwP-cw:WgP---P-'],
        ['hard-main-011', 'cbP-cbP-:ccXwccXw:Xk--Xk--'],
        ['hard-main-012', 'cwP---P-:--cw--cw:RrWrYwWr:Yk------'],
        ['hard-side-029', 'P-cccccc:cmP-P-P-:--CyCyCy:------P-'],
        ['hard-side-031', 'P-P-cycy:cmcmcrcr:cwcwcwcw:WmWmWrWr'],
    ]);
    const plans = new Map([...targets].map(([id, target]) => {
        const plan = planMixedPinCrystalSubassembly(target);
        assert.equal(validateMixedPinCrystalPlan(target, plan).valid, true);
        return [id, plan];
    }));
    assert.equal(plans.get('hard-main-012').prerequisite.left.kind, 'quarter-column-recomposition');
    assert.equal(plans.get('hard-side-029').prerequisite.right.kind, 'mixed-base-upper-transition');
    assert.equal(plans.get('hard-side-031').prerequisite.left.kind, 'crystal-to-pin-support-transition');
    assert.equal(plans.get('hard-side-031').prerequisite.right.kind, 'protected-spatial-crystal-staging');

    const config = new ShapeOperationConfig(4);
    const pinThenCrystal = genCrystal(Shape.fromShapeCode('P-------'), 'w', config)[0].toShapeCode();
    const crystalThenPin = pushPin(Shape.fromShapeCode('cw------'), config)[0].toShapeCode();
    assert.equal(pinThenCrystal, 'cwcwcwcw');
    assert.equal(crystalThenPin, 'P-------:cw------');
    assert.notEqual(pinThenCrystal, crystalThenPin, 'Pin/Crystal operation order is not canonicalized away');

    const unsupportedCrystal = stack(
        Shape.fromShapeCode('--P---P-'), Shape.fromShapeCode('--cw--cw'), config,
    )[0].toShapeCode();
    assert.equal(unsupportedCrystal, '--P---P-', 'detached Crystal shatters before an unsupported upper operand can fall');

    const generated = await buildHard53x1({ write: false });
    const catalog = JSON.parse(await readFile(new URL('../benchmarks/input_catalog.json', import.meta.url), 'utf8'));
    for (const id of targets.keys()) {
        const instance = generated.artifact.instances.find(candidate => candidate.targetId === id);
        assert.ok(instance, `${id} was not generated`);
        assert.equal(replayWitness(instance, catalog).valid, true);
    }

    const unavailable = clone(generated.artifact.instances.find(instance => instance.targetId === 'hard-main-007'));
    const usedShape = unavailable.witness.initial[0].shape;
    const available = unavailable.availableInputs.find(input => input.shape === usedShape);
    available.count -= 1;
    if (available.count === 0) unavailable.availableInputs.splice(unavailable.availableInputs.indexOf(available), 1);
    const rejected = replayWitness(unavailable, catalog);
    assert.equal(rejected.valid, false);
    assert.match(rejected.errors.join('|'), /available|only x/i);
});

test('Splitter remains disabled until throughput success semantics are decided', async () => {
    const { catalog } = await buildPilot({ write: false });
    const instance = {
        track: 'side', target: 'RuCuWuCu', inputs: [{ shape: 'RuCuWuCu', count: 1 }],
        rules: { maxLayers: 4, cleanPainting: true, allowSplitting: true },
        witness: {
            initial: [{ id: 0, shape: 'RuCuWuCu' }],
            steps: [{
                operation: 'Splitter', inputs: [0], params: {},
                outputs: [{ id: 1, shape: 'RuCuWuCu' }, { id: 2, shape: 'RuCuWuCu' }],
            }],
            resultId: 1,
        },
    };
    const replay = replayWitness(instance, catalog);
    assert.equal(replay.valid, false);
    assert.match(replay.errors.join('|'), /disabled pending.*throughput success semantics/i);
});

test('cleanPainting switch is honored by replay while formal profiles keep it enabled', async () => {
    const { catalog } = await buildPilot({ write: false });
    const instance = {
        track: 'side', target: 'RbCbWbCb', inputs: [{ shape: 'RuCuWuCu', count: 1 }],
        rules: { maxLayers: 4, cleanPainting: false, allowSplitting: false },
        witness: {
            initial: [{ id: 0, shape: 'RuCuWuCu' }],
            steps: [
                { operation: 'Painter', inputs: [0], outputs: [{ id: 1, shape: 'RrCrWrCr' }], params: { color: 'r' } },
                { operation: 'Painter', inputs: [1], outputs: [{ id: 2, shape: 'RbCbWbCb' }], params: { color: 'b' } },
            ],
            resultId: 2,
        },
    };
    assert.equal(replayWitness(instance, catalog).valid, true);
    const clean = clone(instance); clean.rules.cleanPainting = true;
    assert.match(replayWitness(clean, catalog).errors.join('|'), /clean-painting/);
});

test('duplicate input rows aggregate metadata correctly and formal artifacts reject the duplicate representation', async () => {
    const metadata = deriveMetadata({
        target: 'RuCuWuCu',
        inputs: [{ shape: 'RuCuWuCu', count: 1 }, { shape: 'RuCuWuCu', count: 2 }],
    }, {
        witnessDepth: 0, operationCount: 0, operationCounts: {}, targetGroup: null, liveWasteCount: 0,
    });
    assert.equal(metadata.inputTypes, 1);
    assert.equal(metadata.inputMultiplicity, 3);
    assert.equal(metadata.maxInputMultiplicity, 3);

    const audited = await auditPilot({ write: false });
    const artifact = clone(audited.artifact);
    const instance = artifact.instances[0];
    const first = instance.inputs[0];
    instance.inputs.splice(0, 1, { shape: first.shape, count: 1 }, { shape: first.shape, count: first.count });
    const directory = await mkdtemp(path.join(tmpdir(), 'benchmark-duplicate-'));
    const artifactPath = path.join(directory, 'instances.json');
    await writeFile(artifactPath, JSON.stringify(artifact));
    try {
        const validation = await validateBenchmarkArtifact({ releaseId: 'hard-pilot-audit-v2', artifactPath, validateRelease: false });
        assert.match(validation.errors.join('|'), /duplicate input rows/);
    } finally { await rm(directory, { recursive: true, force: true }); }
});

test('causal fingerprint rejects superficial family inflation', async () => {
    const catalog = JSON.parse(await readFile(new URL('../benchmarks/input_catalog.json', import.meta.url), 'utf8'));
    const direct = {
        track: 'side', target: 'CuCu----', inputs: [{ shape: 'CuCu----', count: 1 }], rules: RULES,
        witness: { initial: [{ id: 0, shape: 'CuCu----' }], steps: [], resultId: 0 },
    };
    const identityCut = clone(direct);
    identityCut.witness.steps.push({ operation: 'Cutter', inputs: [0], outputs: [{ id: 1, shape: 'CuCu----' }], params: {} });
    identityCut.witness.resultId = 1;
    const cutChain = clone(identityCut);
    cutChain.witness.steps.push(
        { operation: 'Cutter', inputs: [1], outputs: [{ id: 2, shape: 'CuCu----' }], params: {} },
        { operation: 'Cutter', inputs: [2], outputs: [{ id: 3, shape: 'CuCu----' }], params: {} },
    );
    cutChain.witness.resultId = 3;
    const directSignature = fingerprintAfterReplay(direct, catalog).signature;
    assert.equal(fingerprintAfterReplay(identityCut, catalog).signature, directSignature, 'audit identity-Cutter counterexample stays in the original family');
    assert.equal(fingerprintAfterReplay(cutChain, catalog).signature, directSignature, 'an empty-effect Cutter chain cannot mint families');

    const relabeled = clone(cutChain);
    relabeled.witness = relabelWitness(relabeled.witness);
    assert.equal(fingerprintAfterReplay(relabeled, catalog).signature, directSignature, 'token ids are bookkeeping only');

    const terminalByproduct = clone(direct);
    terminalByproduct.inputs.push({ shape: 'RuCuWuCu', count: 1 });
    terminalByproduct.witness.initial.push({ id: 10, shape: 'RuCuWuCu' });
    terminalByproduct.witness.steps.push({
        operation: 'Cutter', inputs: [10], params: {},
        outputs: [{ id: 11, shape: '----WuCu' }, { id: 12, shape: 'RuCu----' }],
    });
    assert.equal(fingerprintAfterReplay(terminalByproduct, catalog).signature, directSignature, 'unrelated terminal byproducts are outside result ancestry');

    const swapper = {
        track: 'side', target: 'RuCuSuCu', inputs: [{ shape: 'RuCuWuCu', count: 1 }, { shape: 'CuWuSuCu', count: 1 }], rules: RULES,
        witness: {
            initial: [{ id: 0, shape: 'RuCuWuCu' }, { id: 1, shape: 'CuWuSuCu' }],
            steps: [{ operation: 'Swapper', inputs: [0, 1], params: {}, outputs: [{ id: 2, shape: 'RuCuSuCu' }, { id: 3, shape: 'CuWuWuCu' }] }],
            resultId: 2,
        },
    };
    const reorderedOutputs = clone(swapper);
    reorderedOutputs.witness.steps[0].outputs.reverse();
    assert.equal(fingerprintAfterReplay(reorderedOutputs, catalog).signature, fingerprintAfterReplay(swapper, catalog).signature, 'unordered output declaration is equivalent bookkeeping');

    const reorderedInitial = clone(swapper);
    reorderedInitial.witness.initial.reverse();
    assert.equal(fingerprintAfterReplay(reorderedInitial, catalog).signature, fingerprintAfterReplay(swapper, catalog).signature, 'initial token ordering is bookkeeping only');

    const reversedInputs = clone(swapper);
    reversedInputs.witness.steps[0].inputs.reverse();
    const swapperReplay = replayWitness(swapper, catalog);
    const reversedReplay = replayWitness(reversedInputs, catalog);
    assert.equal(swapperReplay.valid, true);
    assert.equal(reversedReplay.valid, true);
    assert.equal(
        deriveStructuralFingerprint(reversedInputs, reversedReplay).signature,
        deriveStructuralFingerprint(swapper, swapperReplay).signature,
        'replay-proven Swapper operand symmetry is canonical structural bookkeeping',
    );

    const { artifact } = await auditPilot({ write: false });
    const scheduled = artifact.instances[0];
    const scheduledFingerprint = fingerprintAfterReplay(scheduled, catalog).signature;
    let independentSchedule = null;
    for (let index = 0; index + 1 < scheduled.witness.steps.length; index++) {
        const candidate = clone(scheduled);
        [candidate.witness.steps[index], candidate.witness.steps[index + 1]] = [candidate.witness.steps[index + 1], candidate.witness.steps[index]];
        if (replayWitness(candidate, catalog).valid) { independentSchedule = candidate; break; }
    }
    assert.ok(independentSchedule, 'fixture contains independently schedulable siblings');
    assert.equal(fingerprintAfterReplay(independentSchedule, catalog).signature, scheduledFingerprint);
});

test('three independent Swappers canonicalize all 2^3 input orderings to one family', async () => {
    const catalog = JSON.parse(await readFile(new URL('../benchmarks/input_catalog.json', import.meta.url), 'utf8'));
    const builder = new WitnessBuilder(4);
    const primaryOutputs = [];
    for (let index = 0; index < 3; index++) {
        const outputs = builder.operate('Swapper', [builder.input('RuCuWuCu'), builder.input('CuWuSuCu')]);
        primaryOutputs.push(outputs.find(id => builder.shape(id) === 'RuCuSuCu'));
    }
    const twoLayers = builder.operate('Stacker', primaryOutputs.slice(0, 2))[0];
    const resultId = builder.operate('Stacker', [twoLayers, primaryOutputs[2]])[0];
    const base = {
        track: 'side', target: builder.shape(resultId),
        inputs: [{ shape: 'RuCuWuCu', count: 3 }, { shape: 'CuWuSuCu', count: 3 }],
        rules: RULES, witness: builder.witness(resultId),
    };
    const signatures = new Set();
    for (let mask = 0; mask < 8; mask++) {
        const variant = clone(base);
        for (let swapperIndex = 0; swapperIndex < 3; swapperIndex++) {
            if (mask & (1 << swapperIndex)) variant.witness.steps[swapperIndex].inputs.reverse();
        }
        const replay = replayWitness(variant, catalog);
        assert.equal(replay.valid, true, `variant ${mask}: ${replay.errors?.join('; ')}`);
        signatures.add(deriveStructuralFingerprint(variant, replay).signature);
    }
    assert.equal(signatures.size, 1, 'all eight replay-valid witnesses belong to one structural family');
});

test('order-sensitive Stacker remains a negative control for operand canonicalization', async () => {
    const catalog = JSON.parse(await readFile(new URL('../benchmarks/input_catalog.json', import.meta.url), 'utf8'));
    const makeStack = reversed => {
        const builder = new WitnessBuilder(4);
        const left = builder.input('RuCuWuCu');
        const right = builder.input('CuWuSuCu');
        const resultId = builder.operate('Stacker', reversed ? [right, left] : [left, right])[0];
        return {
            track: 'side', target: builder.shape(resultId),
            inputs: [{ shape: 'RuCuWuCu', count: 1 }, { shape: 'CuWuSuCu', count: 1 }],
            rules: RULES, witness: builder.witness(resultId),
        };
    };
    const forward = makeStack(false);
    const reversed = makeStack(true);
    assert.notEqual(forward.target, reversed.target, 'reversing the concrete Stack operands changes its result');
    assert.notEqual(
        fingerprintAfterReplay(forward, catalog).signature,
        fingerprintAfterReplay(reversed, catalog).signature,
        'an order-sensitive operation must not be merged by Swapper canonicalization',
    );
});

test('causal fingerprint separates replay-valid construction ancestry and preserves Pin/Crystal dependencies', async () => {
    const catalog = JSON.parse(await readFile(new URL('../benchmarks/input_catalog.json', import.meta.url), 'utf8'));
    const directHalf = {
        track: 'side', target: 'CuCu----', inputs: [{ shape: 'CuCu----', count: 1 }], rules: RULES,
        witness: { initial: [{ id: 0, shape: 'CuCu----' }], steps: [], resultId: 0 },
    };
    const derivedHalf = {
        track: 'side', target: 'CuCu----', inputs: [{ shape: 'CuCuCuCu', count: 1 }], rules: RULES,
        witness: {
            initial: [{ id: 0, shape: 'CuCuCuCu' }],
            steps: [{ operation: 'Cutter', inputs: [0], params: {}, outputs: [{ id: 1, shape: '----CuCu' }, { id: 2, shape: 'CuCu----' }] }],
            resultId: 2,
        },
    };
    assert.notEqual(fingerprintAfterReplay(directHalf, catalog).signature, fingerprintAfterReplay(derivedHalf, catalog).signature, 'direct and derived pieces have different ancestry');

    const directFull = {
        track: 'side', target: 'CuCuCuCu', inputs: [{ shape: 'CuCuCuCu', count: 1 }], rules: RULES,
        witness: { initial: [{ id: 0, shape: 'CuCuCuCu' }], steps: [], resultId: 0 },
    };
    const cutAndReassemble = clone(derivedHalf);
    cutAndReassemble.target = 'CuCuCuCu';
    cutAndReassemble.witness.steps.push({ operation: 'Stacker', inputs: [2, 1], params: {}, outputs: [{ id: 3, shape: 'CuCuCuCu' }] });
    cutAndReassemble.witness.resultId = 3;
    assert.notEqual(fingerprintAfterReplay(directFull, catalog).signature, fingerprintAfterReplay(cutAndReassemble, catalog).signature, 'effective shared Cut/Stack topology remains visible');

    const independentExtraction = {
        track: 'side', target: 'CuCuCuCu', inputs: [{ shape: 'CuCuCuCu', count: 2 }], rules: RULES,
        witness: {
            initial: [{ id: 0, shape: 'CuCuCuCu' }, { id: 1, shape: 'CuCuCuCu' }],
            steps: [
                { operation: 'Cutter', inputs: [0], params: {}, outputs: [{ id: 2, shape: '----CuCu' }, { id: 3, shape: 'CuCu----' }] },
                { operation: 'Cutter', inputs: [1], params: {}, outputs: [{ id: 4, shape: '----CuCu' }, { id: 5, shape: 'CuCu----' }] },
                { operation: 'Stacker', inputs: [3, 4], params: {}, outputs: [{ id: 6, shape: 'CuCuCuCu' }] },
            ],
            resultId: 6,
        },
    };
    assert.notEqual(
        fingerprintAfterReplay(cutAndReassemble, catalog).signature,
        fingerprintAfterReplay(independentExtraction, catalog).signature,
        'shared Cutter output reuse remains distinct from two independent extractions',
    );

    const swapperProcessDependency = {
        track: 'side', target: 'RuCuSuCu', inputs: [{ shape: 'RuCuWuCu', count: 1 }, { shape: 'CuWuSuCu', count: 1 }], rules: RULES,
        witness: {
            initial: [{ id: 0, shape: 'RuCuWuCu' }, { id: 1, shape: 'CuWuSuCu' }],
            steps: [{ operation: 'Swapper', inputs: [0, 1], params: {}, outputs: [{ id: 2, shape: 'RuCuSuCu' }, { id: 3, shape: 'CuWuWuCu' }] }],
            resultId: 2,
        },
    };
    const differentProcessSource = clone(swapperProcessDependency);
    differentProcessSource.inputs[1].shape = 'SuSuSuCu';
    differentProcessSource.witness.initial[1].shape = 'SuSuSuCu';
    differentProcessSource.witness.steps[0].outputs[1].shape = 'SuSuWuCu';
    assert.notEqual(
        fingerprintAfterReplay(swapperProcessDependency, catalog).signature,
        fingerprintAfterReplay(differentProcessSource, catalog).signature,
        'a consumed source that changes only the terminal Swapper byproduct remains a causal dependency',
    );

    const directPin = {
        track: 'side', target: 'P-P-----:CuCu----', inputs: [{ shape: 'CuCu----', count: 1 }], rules: RULES,
        witness: {
            initial: [{ id: 0, shape: 'CuCu----' }],
            steps: [{ operation: 'Pin Pusher', inputs: [0], params: {}, outputs: [{ id: 1, shape: 'P-P-----:CuCu----' }] }],
            resultId: 1,
        },
    };
    const derivedPin = clone(derivedHalf);
    derivedPin.target = directPin.target;
    derivedPin.witness.steps.push({ operation: 'Pin Pusher', inputs: [2], params: {}, outputs: [{ id: 3, shape: directPin.target }] });
    derivedPin.witness.resultId = 3;
    assert.notEqual(fingerprintAfterReplay(directPin, catalog).signature, fingerprintAfterReplay(derivedPin, catalog).signature, 'Pin subassembly source ancestry remains visible');

    const directCrystal = clone(directPin);
    directCrystal.target = 'cgcgcgcg:CuCucgcg';
    directCrystal.witness.steps.push({ operation: 'Crystal Generator', inputs: [1], params: { color: 'g' }, outputs: [{ id: 2, shape: directCrystal.target }] });
    directCrystal.witness.resultId = 2;
    const derivedCrystal = clone(derivedPin);
    derivedCrystal.target = directCrystal.target;
    derivedCrystal.witness.steps.push({ operation: 'Crystal Generator', inputs: [3], params: { color: 'g' }, outputs: [{ id: 4, shape: directCrystal.target }] });
    derivedCrystal.witness.resultId = 4;
    const directCrystalGraph = fingerprintAfterReplay(directCrystal, catalog);
    const derivedCrystalGraph = fingerprintAfterReplay(derivedCrystal, catalog);
    assert.notEqual(directCrystalGraph.signature, derivedCrystalGraph.signature, 'Crystal scaffold ancestry remains visible');
    assert.match(derivedCrystalGraph.canonical, /Crystal Generator/);
    assert.match(derivedCrystalGraph.canonical, /Pin Pusher/);
    assert.match(derivedCrystalGraph.canonical, /prepared-piece/);
});

test('generation framework exposes Swapper while tracking both outputs', () => {
    const builder = new WitnessBuilder(4);
    const outputs = builder.operate('Swapper', [builder.input('RuCuWuCu'), builder.input('SuSuRuCu')]);
    assert.equal(outputs.length, 2);
    assert.equal(builder.steps[0].outputs.length, 2);
});

test('repository policy rejects unknown versions, arbitrary profiles, incomplete membership, nonofficial targets and forged metadata', async () => {
    const { artifact: source } = await auditPilot({ write: false });
    const cases = [
        ['unknown version', artifact => { artifact.schemaVersion = 999; }, /unsupported artifact schemaVersion/],
        ['unknown instance schema', artifact => { artifact.benchmarkInstanceSchemaVersion = 999; artifact.instances.forEach(instance => { instance.schemaVersion = 999; }); }, /unsupported benchmark instance schemaVersion/],
        ['schema extra field', artifact => { artifact.untrusted = true; }, /must NOT have additional properties/],
        ['arbitrary suite', artifact => { artifact.suite = 'insane'; }, /suite/],
        ['arbitrary partition', artifact => { artifact.partition = 'holdout'; }, /partition/],
        ['incomplete membership', artifact => { artifact.targetIds.pop(); }, /complete ordered membership/],
        ['nonofficial target', artifact => { artifact.instances[0].targetId = 'hard-side-999'; }, /not in the repository profile/],
        ['forged semantics metadata', artifact => { artifact.instances[0].provenance.gameSemanticsSha256 = '0'.repeat(64); }, /gameSemanticsSha256 differs/],
        ['forged catalog metadata', artifact => { artifact.instances[0].provenance.catalogSha256 = '0'.repeat(64); }, /catalogSha256 differs/],
        ['forged seed identity', artifact => { artifact.instances[0].provenance.inputSeedIdentity = 'invented-seed'; }, /inputSeedIdentity differs/],
        ['formal cleanPainting override', artifact => { artifact.instances[0].rules.cleanPainting = false; }, /rules differ from repository profile/],
    ];
    const directory = await mkdtemp(path.join(tmpdir(), 'benchmark-boundary-'));
    try {
        for (const [name, mutate, pattern] of cases) {
            const artifact = clone(source); mutate(artifact);
            const artifactPath = path.join(directory, `${name.replaceAll(' ', '-')}.json`);
            await writeFile(artifactPath, JSON.stringify(artifact));
            const validation = await validateBenchmarkArtifact({ releaseId: 'hard-pilot-audit-v2', artifactPath, validateRelease: false });
            assert.equal(validation.valid, false, name);
            assert.match(validation.errors.join('|'), pattern, name);
        }
        const unknownRelease = await validateBenchmarkArtifact({ releaseId: 'made-up-release' });
        assert.match(unknownRelease.errors.join('|'), /unknown repository release profile/);
    } finally { await rm(directory, { recursive: true, force: true }); }
});

test('difficulty comparison uses canonical object keys while preserving array order', async () => {
    const { artifact: source } = await auditPilot({ write: false });
    const directory = await mkdtemp(path.join(tmpdir(), 'benchmark-difficulty-canonical-'));
    try {
        const reorderedKeys = clone(source);
        reorderedKeys.instances.forEach(instance => {
            instance.difficulty = reverseObjectKeyOrder(instance.difficulty);
        });
        refreshArtifactSelfHashes(reorderedKeys);
        const reorderedPath = path.join(directory, 'reordered-keys.json');
        await writeFile(reorderedPath, JSON.stringify(reorderedKeys));
        const accepted = await validateBenchmarkArtifact({
            releaseId: 'hard-pilot-audit-v2', artifactPath: reorderedPath, validateRelease: false,
        });
        assert.equal(accepted.valid, true, accepted.errors.join('\n'));

        const reorderedArray = clone(source);
        const instance = reorderedArray.instances.find(candidate => candidate.difficulty.structuralTags.length > 1);
        assert.ok(instance, 'fixture contains an ordered difficulty array with multiple elements');
        instance.difficulty.structuralTags.reverse();
        refreshArtifactSelfHashes(reorderedArray);
        const arrayPath = path.join(directory, 'reordered-array.json');
        await writeFile(arrayPath, JSON.stringify(reorderedArray));
        const rejected = await validateBenchmarkArtifact({
            releaseId: 'hard-pilot-audit-v2', artifactPath: arrayPath, validateRelease: false,
        });
        assert.equal(rejected.valid, false);
        assert.match(rejected.errors.join('|'), /difficulty metadata is not mechanically derived/);
    } finally { await rm(directory, { recursive: true, force: true }); }
});

test('repository policy rejects a catalog that claims the seed hash but changes seed content', async () => {
    const catalog = JSON.parse(await readFile(new URL('../benchmarks/input_catalog.json', import.meta.url), 'utf8'));
    catalog.ordinary.full.push('RuRu----');
    const directory = await mkdtemp(path.join(tmpdir(), 'benchmark-catalog-'));
    const catalogPath = path.join(directory, 'catalog.json');
    await writeFile(catalogPath, JSON.stringify(catalog));
    try {
        const validation = await validateBenchmarkArtifact({ releaseId: 'hard-pilot-audit-v2', catalogPath, validateRelease: false });
        assert.equal(validation.valid, false);
        assert.match(validation.errors.join('|'), /catalog:|differs from the human input seed/);
    } finally { await rm(directory, { recursive: true, force: true }); }
});

test('repository policy rejects an altered official target manifest even when instance metadata is unchanged', async () => {
    const manifest = JSON.parse(await readFile(new URL('../benchmarks/manifest.json', import.meta.url), 'utf8'));
    manifest.cases.find(item => item.id === 'hard-side-006').target = 'RuRuRuRu';
    const directory = await mkdtemp(path.join(tmpdir(), 'benchmark-targets-'));
    const manifestPath = path.join(directory, 'manifest.json');
    await writeFile(manifestPath, JSON.stringify(manifest));
    try {
        const validation = await validateBenchmarkArtifact({ releaseId: 'hard-pilot-audit-v2', manifestPath, validateRelease: false });
        assert.equal(validation.valid, false);
        assert.match(validation.errors.join('|'), /official targets:|differs from official source/);
    } finally { await rm(directory, { recursive: true, force: true }); }
});

test('v3 partition schema uses controlled release profiles rather than one hard-coded pilot value', async () => {
    const source = JSON.parse(await readFile(new URL('../benchmarks/expansion-pilot/v1/instances.json', import.meta.url), 'utf8'));
    const directory = await mkdtemp(path.join(tmpdir(), 'benchmark-partition-profile-'));
    try {
        const development = clone(source);
        development.partition = 'development';
        development.instances.forEach(instance => { instance.partition = 'development'; });
        refreshArtifactSelfHashes(development);
        const developmentPath = path.join(directory, 'development.json');
        await writeFile(developmentPath, JSON.stringify(development));
        const controlled = await validateBenchmarkArtifact({ releaseId: 'hard-expansion-pilot-v1', artifactPath: developmentPath, validateRelease: false });
        assert.equal(controlled.valid, false);
        assert.match(controlled.errors.join('|'), /differs from policy expansion-pilot|suite\/partition differs/);
        assert.equal(controlled.errors.some(error => error.includes('schema')), false, controlled.errors.join('\n'));

        const arbitrary = clone(source);
        arbitrary.partition = 'custom-free-form';
        arbitrary.instances.forEach(instance => { instance.partition = 'custom-free-form'; });
        refreshArtifactSelfHashes(arbitrary);
        const arbitraryPath = path.join(directory, 'arbitrary.json');
        await writeFile(arbitraryPath, JSON.stringify(arbitrary));
        const rejected = await validateBenchmarkArtifact({ releaseId: 'hard-expansion-pilot-v1', artifactPath: arbitraryPath, validateRelease: false });
        assert.match(rejected.errors.join('|'), /schema.*must be equal to one of the allowed values/);
    } finally { await rm(directory, { recursive: true, force: true }); }
});

test('trusted release binds the canonical content of the actual external artifact', async () => {
    const source = JSON.parse(await readFile(new URL('../benchmarks/expansion-pilot/v1/instances.json', import.meta.url), 'utf8'));
    const mutations = [
        ['generatorVersion', artifact => { artifact.instances[0].provenance.generatorVersion = 'forged-generator'; }],
        ['generatorSourceSha256', artifact => { artifact.instances[0].provenance.generatorSourceSha256 = '0'.repeat(64); }],
        ['availableInputs multiplicity', artifact => { artifact.instances[0].availableInputs[0].count += 1; }],
        ['expansion delta', artifact => { artifact.instances[0].expansion.availableAdded[0].count += 1; }],
        ['difficulty metadata', artifact => { artifact.instances[0].difficulty.operationCount += 1; }],
        ['candidate/rejected counts', artifact => { artifact.candidateCount += 1; artifact.rejectedCount += 1; }],
        ['structure signature', artifact => { artifact.instances[0].diversity.structureSignature = '0'.repeat(64); }],
        ['provenance metadata', artifact => { artifact.instances[0].provenance.inputSeedIdentity = 'forged-seed'; }],
        ['witness identity', artifact => {
            artifact.instances[0].witness = relabelWitness(artifact.instances[0].witness, 5000);
            artifact.instances[0].expansion.bridgeTokenIds = artifact.instances[0].expansion.bridgeTokenIds.map(id => id + 5000);
        }],
        ['release identity/schema version', artifact => {
            artifact.releaseId = 'hard-expansion-pilot-v2';
            artifact.name = 'hard-expansion-pilot-v2';
            artifact.schemaVersion = 2;
            artifact.instances.forEach(instance => { instance.provenance.releaseId = 'hard-expansion-pilot-v2'; });
        }],
    ];
    const directory = await mkdtemp(path.join(tmpdir(), 'benchmark-release-content-'));
    try {
        for (const [name, mutate] of mutations) {
            const artifact = clone(source);
            mutate(artifact);
            refreshArtifactSelfHashes(artifact);
            const artifactPath = path.join(directory, `${name.replaceAll(/[ /]/g, '-')}.json`);
            await writeFile(artifactPath, JSON.stringify(artifact, null, name.length % 3 + 1));
            const validation = await validateBenchmarkArtifact({ releaseId: EXPANSION_MANIFEST_REVISION, artifactPath, validateRelease: true });
            assert.equal(validation.valid, false, name);
            assert.match(validation.errors.join('|'), /actual artifact canonical content differs from trusted release/, name);
        }

        const developmentArtifact = clone(source);
        developmentArtifact.instances[0].provenance.generatorVersion = 'development-only-rewrite';
        refreshArtifactSelfHashes(developmentArtifact);
        const developmentPath = path.join(directory, 'development-only.json');
        await writeFile(developmentPath, JSON.stringify(developmentArtifact));
        const developmentValidation = await validateBenchmarkArtifact({
            releaseId: 'hard-expansion-pilot-v1', artifactPath: developmentPath, validateRelease: false,
        });
        assert.equal(developmentValidation.valid, true, developmentValidation.errors.join('\n'));
        assert.equal(developmentValidation.summary.releaseValidationPerformed, false);
        assert.equal(developmentValidation.summary.releaseAcceptance, false);
    } finally { await rm(directory, { recursive: true, force: true }); }
});

test('canonical release identity accepts a content-identical artifact copy and binds the public solver projection', async () => {
    const source = JSON.parse(await readFile(new URL('../benchmarks/expansion-pilot/v1/instances.json', import.meta.url), 'utf8'));
    const reorderedTopLevel = Object.fromEntries(Object.entries(source).reverse());
    const directory = await mkdtemp(path.join(tmpdir(), 'benchmark-release-copy-'));
    const artifactPath = path.join(directory, 'renamed-copy.json');
    await writeFile(artifactPath, JSON.stringify(reorderedTopLevel));
    try {
        const validation = await validateBenchmarkArtifact({ releaseId: EXPANSION_MANIFEST_REVISION, artifactPath });
        assert.equal(validation.valid, true, validation.errors.join('\n'));
        assert.equal(validation.summary.releaseAcceptance, true);

        const releasedProjection = JSON.parse(await readFile(new URL('../benchmarks/expansion-pilot/v1/solver-inputs.json', import.meta.url), 'utf8'));
        assert.equal(releasedProjection.sourceReleaseId, source.releaseId);
        assert.deepEqual(releasedProjection.instances.map(item => item.availableInputs), source.instances.map(item => item.availableInputs));
    } finally { await rm(directory, { recursive: true, force: true }); }
});

test('manifest revision identity is independent from immutable artifact release identity without changing semantic validation', async () => {
    const pairs = [
        ['hard-pilot-audit-v2', PILOT_MANIFEST_REVISION],
        ['hard-coverage-pilot-v1', COVERAGE_MANIFEST_REVISION],
        ['hard-expansion-pilot-v1', EXPANSION_MANIFEST_REVISION],
        ['hard-53x1-stage-v1', HARD_53X1_MANIFEST_REVISION],
    ];
    for (const [artifactReleaseId, manifestRevisionId] of pairs) {
        const semanticOnly = await validateBenchmarkArtifact({ releaseId: artifactReleaseId, validateRelease: false });
        const trustedRevision = await validateBenchmarkArtifact({ releaseId: manifestRevisionId, validateRelease: true });
        assert.equal(semanticOnly.valid, true, semanticOnly.errors.join('\n'));
        assert.equal(trustedRevision.valid, true, trustedRevision.errors.join('\n'));
        assert.equal(trustedRevision.summary.releaseAcceptance, true);
        assert.equal(trustedRevision.summary.releaseId, artifactReleaseId);
        assert.equal(trustedRevision.summary.manifestRevisionId, manifestRevisionId);
        for (const key of ['targetCount', 'instanceCount', 'mechanicallyReplayed', 'structuralFamilies', 'sha256']) {
            assert.equal(trustedRevision.summary[key], semanticOnly.summary[key], `${manifestRevisionId}: ${key}`);
        }
    }
});

test('manifest revision identity rejects cross-binding, tampering, stale rules and incorrect policy pins', async () => {
    const policy = JSON.parse(await readFile(new URL('../benchmarks/policy/official-policy.v1.json', import.meta.url), 'utf8'));
    const artifact = JSON.parse(await readFile(new URL('../benchmarks/expansion-pilot/v1/instances.json', import.meta.url), 'utf8'));
    const currentManifest = JSON.parse(await readFile(new URL('../benchmarks/releases/hard-expansion-pilot-v1-manifest-r2.release.json', import.meta.url), 'utf8'));
    const schemaRuntime = await createBenchmarkSchemaValidator();
    const baseProfile = policy.profiles[EXPANSION_MANIFEST_REVISION];
    const directory = await mkdtemp(path.join(tmpdir(), 'benchmark-manifest-revision-'));

    async function validateManifestMutation(name, mutate) {
        const manifest = clone(currentManifest);
        mutate(manifest);
        const manifestPath = path.join(directory, `${name}.release.json`);
        const content = `${JSON.stringify(manifest, null, 2)}\n`;
        await writeFile(manifestPath, content);
        const profile = {
            ...clone(baseProfile),
            releaseManifestPath: manifestPath,
            releaseManifestSha256: sha256(content),
        };
        return validateBenchmarkRelease({ policy, profile, artifact, schemaRuntime });
    }

    try {
        const correct = await validateBenchmarkRelease({ policy, profile: baseProfile, artifact, schemaRuntime });
        assert.equal(correct.valid, true, correct.errors.join('\n'));

        const wrongArtifactRelease = await validateManifestMutation('wrong-artifact-release', manifest => {
            manifest.artifactReleaseId = 'hard-expansion-pilot-v999';
        });
        assert.match(wrongArtifactRelease.errors.join('|'), /artifactReleaseId differs/);

        const wrongManifestRevision = await validateManifestMutation('wrong-manifest-revision', manifest => {
            manifest.manifestRevisionId = 'hard-expansion-pilot-v1-manifest-forged';
        });
        assert.match(wrongManifestRevision.errors.join('|'), /manifestRevisionId differs/);

        const wrongRulesHash = await validateManifestMutation('wrong-rules-hash', manifest => {
            manifest.bindings.benchmarkRules.sha256 = '0'.repeat(64);
        });
        assert.match(wrongRulesHash.errors.join('|'), /release benchmarkRules/);

        const wrongProjectionHash = await validateManifestMutation('wrong-projection-hash', manifest => {
            manifest.bindings.solverProjection.sha256 = '0'.repeat(64);
        });
        assert.match(wrongProjectionHash.errors.join('|'), /solver projection canonical content differs/);

        const wrongPolicyPin = await validateBenchmarkRelease({
            policy,
            profile: { ...clone(baseProfile), releaseManifestSha256: '0'.repeat(64) },
            artifact,
            schemaRuntime,
        });
        assert.match(wrongPolicyPin.errors.join('|'), /release manifest hash differs from repository policy/);

        const historical = policy.historicalManifestRevisions['hard-expansion-pilot-v1'];
        const staleRules = await validateBenchmarkRelease({
            policy,
            profile: {
                ...clone(baseProfile),
                profileId: historical.artifactReleaseId,
                artifactReleaseId: historical.artifactReleaseId,
                releaseManifestPath: historical.path,
                releaseManifestSha256: historical.sha256,
            },
            artifact,
            schemaRuntime,
        });
        assert.match(staleRules.errors.join('|'), /release benchmarkRules/);

        const forgedArtifact = clone(artifact);
        forgedArtifact.releaseId = 'hard-expansion-pilot-v999';
        const forgedArtifactPath = path.join(directory, 'forged-artifact-release.json');
        await writeFile(forgedArtifactPath, JSON.stringify(forgedArtifact));
        const forgedArtifactValidation = await validateBenchmarkArtifact({
            releaseId: EXPANSION_MANIFEST_REVISION,
            artifactPath: forgedArtifactPath,
        });
        assert.match(forgedArtifactValidation.errors.join('|'), /artifact releaseId .* differs from profile artifactReleaseId|actual artifact canonical content differs/);
    } finally { await rm(directory, { recursive: true, force: true }); }
});
