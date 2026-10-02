import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
    buildHard53x3DeepDiversity, DEEP_DIVERSITY_BATCH_SIZES,
    KEEP_ALL_TARGET_IDS, REQUIRED_REPLACEMENT_TARGET_IDS,
} from '../benchmarks/tools/build-hard-53x3-deep-diversity.mjs';
import {
    classifyDiversityDepth,
} from '../benchmarks/tools/diversity-depth-classifier.mjs';
import { enumerateAlternativeMacroPlans } from '../benchmarks/tools/macro-plan-enumerator.mjs';
import {
    artifactInstancesHash, deriveStructuralFingerprint, replayWitness,
    validateExpansionMetadata,
} from '../benchmarks/tools/benchmark-core.mjs';
import { createBenchmarkSchemaValidator } from '../benchmarks/tools/schema-validation.mjs';

const load = relative => readFile(new URL(relative, import.meta.url), 'utf8').then(JSON.parse);

test('existing planners enumerate mechanically distinct macro-plan candidates', () => {
    const pin = enumerateAlternativeMacroPlans({ target: 'P-CcRcCc:P-CwRwCw:RwWrP-Wr:P---Wr--' });
    const crystal = enumerateAlternativeMacroPlans({ target: 'crCwcrRw:CwcrCwcr:crCwcrCw:crcrcrcr' });
    const mixed = enumerateAlternativeMacroPlans({ target: 'WwcbWwcb:P-cwP-cw:WgP---P-' });
    assert.ok(pin.length > 1);
    assert.ok(crystal.length > 1);
    assert.ok(mixed.length > 1);
    assert.ok(pin.some(plan => plan.macroClass === 'pin-column-support-partition'));
    assert.ok(crystal.some(plan => plan.macroClass === 'pin-mask-crystal-staging'));
    assert.ok(mixed.some(plan => plan.macroClass === 'mixed-state-transition-routing'));
});

test('depth classifier reproduces the audited 106/106 Level B overlay baseline', async () => {
    const [catalog, baseline, pilot, rollout] = await Promise.all([
        load('../benchmarks/input_catalog.json'),
        load('../benchmarks/hard-53x1/v1/instances.json'),
        load('../benchmarks/diversity-pilot/v1/instances.json'),
        load('../benchmarks/hard-53x3-rollout/v1/instances.json'),
    ]);
    const baselineByTarget = new Map(baseline.instances.map(instance => [instance.targetId, instance]));
    const levels = [];
    for (const candidate of [...pilot.instances, ...rollout.instances]) {
        const source = baselineByTarget.get(candidate.targetId);
        const depth = classifyDiversityDepth(
            source, replayWitness(source, catalog), candidate, replayWitness(candidate, catalog),
        );
        levels.push(depth.level);
    }
    assert.equal(levels.length, 106);
    assert.deepEqual([...new Set(levels)], ['B']);
});

test('deep macro-plan pass preserves authority and accepts only replay-valid C/D/E replacements', async () => {
    const [generated, committed, catalog, expansionPolicy] = await Promise.all([
        buildHard53x3DeepDiversity({ write: false }),
        load('../benchmarks/hard-53x3-deep-diversity/v1/instances.json'),
        load('../benchmarks/input_catalog.json'),
        load('../benchmarks/policy/input-environment-expansion.v1.json'),
    ]);
    assert.deepEqual(generated.instances, committed.instances);
    assert.equal(REQUIRED_REPLACEMENT_TARGET_IDS.length, 29);
    assert.equal(KEEP_ALL_TARGET_IDS.length, 3);
    assert.deepEqual(DEEP_DIVERSITY_BATCH_SIZES, [8, 8, 7, 6]);
    assert.equal(generated.statuses.length, 29);
    assert.equal(generated.unknownStatuses.length, 21);
    assert.equal(generated.instances.length, 25);
    assert.deepEqual(generated.statistics.required, {
        deepReplacementFound: 25,
        stillShallow: 1,
        probablyLimited: 3,
    });
    assert.deepEqual(generated.statistics.depthDistribution, { D: 15, E: 10 });
    assert.equal(generated.statistics.recommendation, 'diversity quality acceptable → perform final depth re-audit');
    assert.equal(generated.unknownStatuses.every(row => row.status === 'DEEP_ROUTE_FOUND'), true);
    assert.equal(generated.checkpoints.length, 4);
    assert.deepEqual(generated.checkpoints.map(row => row.targetIds.length), [8, 8, 7, 6]);
    assert.equal(generated.integrity.baselineUnchanged, true);
    assert.equal(generated.integrity.structuralCanonicalizationChanged, false);
    assert.equal(generated.integrity.solverFilteringUsed, false);
    assert.equal(generated.integrity.artificialMechanismInjectionUsed, false);
    assert.equal(generated.integrity.compositeReleaseConstructed, false);

    const schemaRuntime = await createBenchmarkSchemaValidator();
    const artifactSchema = schemaRuntime.artifactValidator(3);
    assert.equal(artifactSchema(committed), true, JSON.stringify(artifactSchema.errors));
    assert.equal(committed.sha256, artifactInstancesHash(committed.instances));
    assert.equal(committed.candidateCount, committed.acceptedCount + committed.rejectedCount);
    for (const instance of committed.instances) {
        const replay = replayWitness(instance, catalog);
        assert.equal(replay.valid, true, `${instance.id}: ${replay.errors?.join('; ')}`);
        const expansion = validateExpansionMetadata(instance, catalog, replay, expansionPolicy);
        assert.equal(expansion.valid, true, `${instance.id}: ${expansion.errors.join('; ')}`);
        const structural = deriveStructuralFingerprint(instance, replay);
        assert.equal(structural.signature, instance.diversity.structureSignature);
        const status = generated.statuses.find(row => row.targetId === instance.targetId);
        assert.ok(['C', 'D', 'E'].includes(status.candidateDepth));
        assert.notEqual(structural.signature, status.baselineSignature);
        assert.notEqual(structural.signature, status.retainedSignature);
    }
});
