import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
    buildFinalDepthReselection, RECOVERED_SELECTIONS, RESELECTION_TARGET_IDS,
} from '../benchmarks/tools/build-final-depth-reselection.mjs';
import {
    artifactInstancesHash, deriveStructuralFingerprint, replayWitness,
    validateExpansionMetadata,
} from '../benchmarks/tools/benchmark-core.mjs';
import { createBenchmarkSchemaValidator } from '../benchmarks/tools/schema-validation.mjs';

const load = relative => readFile(new URL(relative, import.meta.url), 'utf8').then(JSON.parse);

test('targeted final depth re-selection reproduces only the scoped candidate artifact', async () => {
    const [generated, committed, catalog, expansionPolicy] = await Promise.all([
        buildFinalDepthReselection({ write: false }),
        load('../benchmarks/final-depth-reselection/v1/instances.json'),
        load('../benchmarks/input_catalog.json'),
        load('../benchmarks/policy/input-environment-expansion.v1.json'),
    ]);
    assert.deepEqual(generated.instances, committed.instances);
    assert.equal(RESELECTION_TARGET_IDS.length, 11);
    assert.equal(Object.keys(RECOVERED_SELECTIONS).length, 11);
    assert.deepEqual(generated.statistics.reselection, {
        replacementsFound: 11,
        remainingGaps: 0,
        depthDistribution: { D: 1, E: 10 },
    });
    assert.deepEqual(generated.statistics.hardMain010, {
        finalClassification: 'DEEP_ROUTE_FOUND',
        candidateCount: 8,
        replayFailures: 6,
        shallowCollapses: 1,
        deepCandidates: 1,
    });
    assert.equal(generated.statistics.proposedReplacementTotal, 42);
    assert.equal(generated.statistics.recommendation, 'READY FOR FINAL TARGETED ACCEPTANCE');
    assert.equal(generated.instances.length, 12);
    assert.equal(generated.reselection.find(row => row.targetId === 'hard-side-031').candidateOperations, 94);
    assert.equal(generated.reselection.find(row => row.targetId === 'hard-side-035').candidateOperations, 40);
    assert.equal(generated.hardMain010.accepted.operationCount, 81);
    assert.equal(generated.hardMain010.accepted.depth, 'E');
    assert.equal(generated.integrity.baselineUnchanged, true);
    assert.equal(generated.integrity.existingAcceptedCandidateArtifactsUnchanged, true);
    assert.equal(generated.integrity.structuralCanonicalizationChanged, false);
    assert.equal(generated.integrity.schemaOrValidatorChanged, false);
    assert.equal(generated.integrity.compositeReleaseConstructed, false);
    assert.equal(generated.integrity.solverFilteringUsed, false);

    const schemaRuntime = await createBenchmarkSchemaValidator();
    const artifactSchema = schemaRuntime.artifactValidator(3);
    assert.equal(artifactSchema(committed), true, JSON.stringify(artifactSchema.errors));
    assert.equal(committed.sha256, artifactInstancesHash(committed.instances));
    for (const instance of committed.instances) {
        const replay = replayWitness(instance, catalog);
        assert.equal(replay.valid, true, `${instance.id}: ${replay.errors?.join('; ')}`);
        const expansion = validateExpansionMetadata(instance, catalog, replay, expansionPolicy);
        assert.equal(expansion.valid, true, `${instance.id}: ${expansion.errors.join('; ')}`);
        const structural = deriveStructuralFingerprint(instance, replay);
        assert.equal(structural.signature, instance.diversity.structureSignature);
    }
});

test('old rotation aliases and inflated replacements remain rejected', async () => {
    const candidateLog = await load('../benchmarks/final-depth-reselection/v1/candidate-log.json');
    const oldSelections = {
        'hard-main-005': 3,
        'hard-main-006': 3,
        'hard-main-007': 3,
        'hard-side-022': 1,
        'hard-side-023': 3,
        'hard-side-025': 2,
        'hard-side-026': 3,
        'hard-side-028': 2,
        'hard-side-036': 2,
    };
    for (const [targetId, originalCandidateId] of Object.entries(oldSelections)) {
        const row = candidateLog.find(candidate => candidate.targetId === targetId
            && candidate.originalCandidateId === originalCandidateId);
        assert.ok(row, `${targetId}: missing old selection`);
        assert.ok(['A', 'B'].includes(row.normalizedDepth), `${targetId}: old rotation alias stayed deep`);
        assert.equal(row.rotationMaterialAlias, true);
    }
    const side031 = candidateLog.find(candidate => candidate.targetId === 'hard-side-031'
        && candidate.originalCandidateId === 2);
    const side035 = candidateLog.find(candidate => candidate.targetId === 'hard-side-035'
        && candidate.originalCandidateId === 5);
    assert.equal(side031.operationCount, 311);
    assert.equal(side035.operationCount, 360);
});
