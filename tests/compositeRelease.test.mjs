import { historicalV1Test } from './helpers/historicalV1Test.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { canonicalJson, sha256 } from '../benchmarks/tools/benchmark-core.mjs';
import { compositeManifestIdentity } from '../benchmarks/tools/composite-release-core.mjs';
import { validateCompositeRelease } from '../benchmarks/tools/validate-composite-release.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = path.join(ROOT, 'benchmarks/releases/hard-53x3-stage-v1.release.json');

async function load(filePath) {
    return JSON.parse(await readFile(filePath, 'utf8'));
}

function clone(value) {
    return structuredClone(value);
}

function reverseObjectKeys(value) {
    if (Array.isArray(value)) return value.map(reverseObjectKeys);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, reverseObjectKeys(child)]));
}

async function validateTamper(base, mutate) {
    const directory = await mkdtemp(path.join(tmpdir(), 'composite-release-tamper-'));
    try {
        const manifest = clone(base);
        mutate(manifest);
        manifest.compositeCanonicalSha256 = compositeManifestIdentity(manifest);
        const filePath = path.join(directory, 'manifest.json');
        await writeFile(filePath, `${JSON.stringify(manifest, null, 2)}\n`);
        return await validateCompositeRelease({ manifestPath: filePath, validateTrust: false });
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
}

historicalV1Test('released composite deterministically resolves all 159 provenance-preserving members', async () => {
    const result = await validateCompositeRelease();
    assert.equal(result.valid, true, result.errors.join('\n'));
    assert.deepEqual({
        sources: result.summary.sourceArtifactCount,
        targets: result.summary.targetCount,
        members: result.summary.memberCount,
        provenance: result.summary.provenanceResolved,
        replay: result.summary.mechanicallyReplayed,
        expansion: result.summary.expansionValidated,
        fingerprints: result.summary.fingerprintsValidated,
    }, { sources: 6, targets: 53, members: 159, provenance: 159, replay: 159, expansion: 159, fingerprints: 159 });
    assert.equal(result.summary.finalSelectionCanonicalSha256, '6e3efdece360e8dd338a49dd3edd8fe10620b288aa161d35a8d01ab966e1b47f');
    assert.equal(result.summary.reconstructedSelectionHash, result.summary.finalSelectionCanonicalSha256);
});

test('composite tamper matrix rejects selection, source, member, family, and cardinality attacks', async t => {
    const base = await load(MANIFEST_PATH);
    const cases = [
        ['modified final-selection hash', manifest => {
            manifest.bindings.finalSelection.selectionCanonicalSha256 = '0'.repeat(64);
        }, /final-selection hash differs from frozen identity/],
        ['substituted source artifact identity', manifest => {
            manifest.sourceRegistry[0].canonicalSha256 = manifest.sourceRegistry[1].canonicalSha256;
        }, /source canonical identity mismatch|source registry binding differs/],
        ['same-target wrong source instance', manifest => {
            const targetMembers = manifest.members.filter(member => member.targetId === manifest.members[0].targetId);
            manifest.members[0].sourceId = targetMembers[1].sourceId;
            manifest.members[0].sourceInstanceId = targetMembers[1].sourceInstanceId;
        }, /sourceInstanceId differs from frozen final selection|incorrect source instance/],
        ['deleted member gives 158', manifest => {
            manifest.members.pop();
        }, /exactly 159|do not reconstruct/],
        ['duplicated member reference', manifest => {
            manifest.members[1] = clone(manifest.members[0]);
        }, /duplicate member reference|duplicate target slot/],
        ['source member signature mismatch', manifest => {
            manifest.members[0].structuralSignature = '0'.repeat(64);
        }, /structural signature mismatch|structuralSignature differs/],
        ['added member gives 160', manifest => {
            manifest.members.push(clone(manifest.members[0]));
        }, /exactly 159|no corresponding final-selection entry/],
        ['target loses one of three unique families', manifest => {
            manifest.members[1].structuralSignature = manifest.members[0].structuralSignature;
        }, /three unique structural families/],
        ['member provenance points to nonexistent source', manifest => {
            manifest.members[0].sourceId = 'missing-source';
        }, /missing source registry reference/],
    ];
    for (const [name, mutate, expected] of cases) {
        await t.test(name, async () => {
            const result = await validateTamper(base, mutate);
            assert.equal(result.valid, false, name);
            assert.match(result.errors.join('\n'), expected);
        });
    }
});

test('source content mutation is detected without rewriting the composite manifest', async () => {
    const manifest = await load(MANIFEST_PATH);
    const source = manifest.sourceRegistry[0];
    const sourceDocument = await load(path.join(ROOT, source.path));
    sourceDocument.instances[0].provenance.generatorVersion = 'tampered-generator';
    const directory = await mkdtemp(path.join(tmpdir(), 'composite-source-tamper-'));
    try {
        const sourcePath = path.join(directory, 'source.json');
        await writeFile(sourcePath, `${JSON.stringify(sourceDocument, null, 2)}\n`);
        const result = await validateCompositeRelease({ sourcePathOverrides: { [source.sourceId]: sourcePath } });
        assert.equal(result.valid, false);
        assert.match(result.errors.join('\n'), /source canonical identity mismatch|source instance content identity mismatch/);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('repository authority file substitution cannot hide behind a re-hashed policy document', async () => {
    const manifest = await load(MANIFEST_PATH);
    const policy = await load(path.join(ROOT, manifest.bindings.repositoryPolicy.path));
    policy.gameSemantics.files[0].sha256 = '0'.repeat(64);
    const directory = await mkdtemp(path.join(tmpdir(), 'composite-authority-tamper-'));
    try {
        const policyPath = path.join(directory, 'policy.json');
        const manifestPath = path.join(directory, 'manifest.json');
        await writeFile(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
        manifest.bindings.repositoryPolicy.path = policyPath;
        manifest.bindings.repositoryPolicy.canonicalSha256 = sha256(canonicalJson(policy));
        manifest.compositeCanonicalSha256 = compositeManifestIdentity(manifest);
        await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
        const result = await validateCompositeRelease({ manifestPath, validateTrust: false });
        assert.equal(result.valid, false);
        assert.match(result.errors.join('\n'), /canonical semantics:/);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

historicalV1Test('JSON formatting and property order do not alter trusted composite identity', async () => {
    const manifest = await load(MANIFEST_PATH);
    const reordered = reverseObjectKeys(manifest);
    assert.equal(canonicalJson(reordered), canonicalJson(manifest));
    assert.equal(compositeManifestIdentity(reordered), manifest.compositeCanonicalSha256);
    const directory = await mkdtemp(path.join(tmpdir(), 'composite-reordered-'));
    try {
        const filePath = path.join(directory, 'manifest.json');
        await writeFile(filePath, JSON.stringify(reordered));
        const result = await validateCompositeRelease({ manifestPath: filePath });
        assert.equal(result.valid, true, result.errors.join('\n'));
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});
