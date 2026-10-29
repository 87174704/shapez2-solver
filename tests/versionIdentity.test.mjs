import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ROOT, json, verifyVersion } from '../versions/identity.mjs';
import { validateFrozenArtifactV2 } from '../versions/benchmark-v2.mjs';
import { SHAPE_OPERATIONS_SEMANTICS } from '../shapeOperations.js';
import { validateCompositeRelease } from '../benchmarks/tools/validate-composite-release.mjs';
import { validateBenchmarkArtifact } from '../benchmarks/tools/validate-benchmark.mjs';
import { buildSolverEvaluationView } from '../benchmarks/tools/environment-expansion.mjs';

const V2 = 'shape-operations-v2-support-closure';
const ARTIFACT = 'benchmarks/expansion-pilot/v1/instances.json';

test('current source strictly verifies as v2 with all frozen benchmark bytes', async () => {
    assert.equal(SHAPE_OPERATIONS_SEMANTICS, V2);
    const result = await verifyVersion({ version: V2 });
    assert.equal(result.valid, true, result.errors.join('\n'));
    assert.equal(result.frozenFilesChecked, 461);
    const release = await json(path.join(ROOT, 'release.json'));
    const index = await json(path.join(ROOT, 'versions/index.json'));
    assert.equal(release.release, V2);
    assert.equal(release.versionManifestCanonicalSha256, index.versions[V2].canonicalSha256);
    assert.equal(release.status, 'local-release-candidate-not-published');
    assert.equal(release.gameCertification, 'UNKNOWN');
});

test('current source cannot certify itself as frozen v1', async () => {
    const result = await verifyVersion({ version: 'shape-operations-v1' });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => /shapeOperations.js hash differs/.test(e)));
});

test('legacy composite and all six trusted profiles actively reject v2 source identity', async () => {
    const result = await validateCompositeRelease();
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
    assert.ok(result.errors.every(e => e.includes('shapeOperations.js') && e.includes('hash')), result.errors.join('\n'));
    const policy = await json(path.join(ROOT, 'benchmarks/policy/official-policy.v1.json'));
    for (const profile of Object.values(policy.profiles)) {
        const r = await validateBenchmarkArtifact({ releaseId: profile.manifestRevisionId });
        assert.equal(r.valid, false);
        assert.ok(r.errors.length > 0);
        assert.ok(r.errors.every(e => e.includes('shapeOperations.js') && e.includes('hash')), r.errors.join('\n'));
    }
});

test('unknown and cross-bound version identities are rejected', async () => {
    assert.equal((await verifyVersion({ version: 'shape-operations-v999' })).valid, false);
    const doc = await json(path.join(ROOT, 'versions/shape-operations-v2-support-closure.json'));
    assert.equal((await verifyVersion({ version: 'shape-operations-v1', manifestDocument: doc })).valid, false);
});

test('v2 manifest tamper matrix rejects version, parent, hash, missing files and aggregates', async t => {
    const source = await json(path.join(ROOT, 'versions/shape-operations-v2-support-closure.json'));
    const mutations = [
        ['version', d => { d.version = 'shape-operations-v1'; }],
        ['parent', d => { d.parent.canonicalSha256 = '0'.repeat(64); }],
        ['source hash', d => { d.semantics.files[1].sha256 = '0'.repeat(64); }],
        ['removed binding', d => { d.semantics.files.pop(); }],
        ['aggregate', d => { d.runtime.sha256 = '0'.repeat(64); }],
        ['inventory', d => { d.frozenInventory.sha256 = '0'.repeat(64); }],
    ];
    for (const [name, mutate] of mutations) await t.test(name, async () => {
        const doc = structuredClone(source); mutate(doc);
        const r = await verifyVersion({ version: V2, manifestDocument: doc });
        assert.equal(r.valid, false);
        assert.ok(r.errors.includes('manifest differs from trusted version pin'));
    });
});

test('v2 source substitution is detected in an isolated implementation tree', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'physics-v2-tamper-'));
    try {
        await fs.writeFile(path.join(directory, 'shapeOperations.js'), '// forged source\n');
        const r = await verifyVersion({ version: V2, root: directory });
        assert.equal(r.valid, false);
        assert.ok(r.errors.includes('semantics: shapeOperations.js hash differs'));
    } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('v2 independently accepts frozen artifact and canonical content-identical copies', async () => {
    const source = await json(path.join(ROOT, ARTIFACT));
    const copy = Object.fromEntries(Object.entries(source).reverse());
    const result = await validateFrozenArtifactV2({ artifactPath: ARTIFACT, artifactDocument: copy,
        projectionDocument: buildSolverEvaluationView(copy) });
    assert.equal(result.valid, true, result.errors.join('\n'));
    assert.equal(result.replayed, 6);
    assert.equal(result.certification, 'v2-replay-of-frozen-v1-inputs');
});

test('v2 frozen artifact tamper matrix binds provenance, resources, witness, difficulty and release', async t => {
    const source = await json(path.join(ROOT, ARTIFACT));
    const mutations = [
        ['provenance', d => { d.instances[0].provenance.generatorVersion = 'forged'; }],
        ['resources', d => { d.instances[0].availableInputs[0].count++; }],
        ['witness', d => { d.instances[0].witness.resultId += 10000; }],
        ['difficulty', d => { d.instances[0].difficulty.operationCount++; }],
        ['release', d => { d.releaseId = V2; }],
        ['array ordering', d => { d.instances.reverse(); }],
    ];
    for (const [name, mutate] of mutations) await t.test(name, async () => {
        const doc = structuredClone(source); mutate(doc);
        const r = await validateFrozenArtifactV2({ artifactPath: ARTIFACT, artifactDocument: doc });
        assert.equal(r.valid, false);
        assert.ok(r.errors.includes('actual artifact canonical content differs from frozen identity'));
    });
});

test('v2 rejects a substituted public solver projection and unregistered artifact', async () => {
    const artifact = await json(path.join(ROOT, ARTIFACT));
    const projection = buildSolverEvaluationView(artifact);
    projection.instances[0].target = 'RuRuRuRu';
    const r = await validateFrozenArtifactV2({ artifactPath: ARTIFACT, projectionDocument: projection });
    assert.equal(r.valid, false);
    assert.ok(r.errors.includes('public projection differs from actual artifact'));
    assert.equal((await validateFrozenArtifactV2({ artifactPath: 'unregistered.json' })).valid, false);
});
