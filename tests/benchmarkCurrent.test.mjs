// Current-physics corpus acceptance and its negative controls.
//
// Purpose: prove two things that the historical v1 gate can no longer prove at HEAD —
// that the released corpus is actually ACCEPTED under the physics the working tree
// contains, and that the accepting machinery still REJECTS corruption. The negative
// controls are deliberately ordered by increasing subtlety:
//   1. witness byte tampering            -> rejected by instance/artifact content binding
//   2. official target identity tampering -> rejected by repository authority
//   3. an illegal physics path with all  -> rejected by replay itself, so the verdict is
//      self-hashes recomputed               semantic and not merely a hash mismatch
//
// These tests choose their mode from the tree they run in, so the same file is valid in
// the current maintenance tree (deferred) and in the reconstructed v1 tree (strict).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ROOT } from '../benchmarks/tools/repository-policy.mjs';
import {
    artifactInstancesHash, instanceContentHash, readJson, replayWitness,
} from '../benchmarks/tools/benchmark-core.mjs';
import { validateBenchmarkArtifact } from '../benchmarks/tools/validate-benchmark.mjs';
import { classifySemanticsErrors, loadSemanticsState, validateCorpus } from '../scripts/bench/validate-corpus.mjs';

// The tree decides the mode: a deferrable game-semantics file means we are outside the
// reconstructed v1 tree, so the strict v1 byte identity cannot apply here.
const state = await loadSemanticsState();
const mode = state.files.some(file => file.deferred) ? 'deferred' : 'strict';
const CATALOG = await readJson(path.join(ROOT, 'benchmarks/input_catalog.json'));
const ARTIFACT = path.join(ROOT, 'benchmarks/coverage-pilot/v1/instances.json');
const RELEASE_ID = 'hard-coverage-pilot-v1';

async function withScratch(run) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'benchmark-current-'));
    try {
        await run(directory);
    } finally {
        await fs.rm(directory, { recursive: true, force: true });
    }
}

// Re-derive every self-hash so that content bindings cannot be the reason for a rejection.
function refreshSelfHashes(artifact) {
    for (const instance of artifact.instances) instance.instanceSha256 = instanceContentHash(instance);
    artifact.sha256 = artifactInstancesHash(artifact.instances);
}

test('released corpus is accepted under the physics the working tree contains', async () => {
    const report = await validateCorpus({ mode });
    assert.equal(report.ok, true, [...report.blocking, ...report.problems].join('\n'));
    assert.equal(report.counts.profiles, 6);
    assert.equal(report.counts.instances, 195);
    assert.equal(report.counts.replayed, 195);
    assert.equal(report.counts.compositeMembers, 159);
    assert.equal(report.composite.mechanicallyReplayed, 159);
    for (const profile of report.profiles) {
        assert.equal(profile.replayed, profile.instances, `${profile.key} did not replay every instance`);
        assert.equal(profile.blocking.length, 0, `${profile.key}: ${profile.blocking.join('|')}`);
    }
});

test('strict mode keeps the historical v1 byte identity instead of weakening it', { skip: mode === 'strict' ? 'working tree already matches the v1 pin' : false }, async () => {
    const report = await validateCorpus({ mode: 'strict' });
    assert.equal(report.ok, false, 'strict mode must not accept current physics bytes');
    assert.ok(report.blocking.length >= 1);
    const semanticsOnly = /(?:release canonicalSemantics|canonical semantics): .+: repository hash [0-9a-f]{64} differs from policy [0-9a-f]{64}/;
    // Every strict rejection must be the historical semantics pin, never a corpus defect.
    for (const message of report.blocking) {
        assert.match(message, semanticsOnly, message);
    }
    assert.equal(report.profiles.every(profile => profile.blocking.every(message => semanticsOnly.test(message))), true);
    assert.equal(report.profiles.every(profile => profile.replayed === profile.instances), true);
});

test('negative control 1: witness tampering is rejected by the content binding', async () => {
    await withScratch(async directory => {
        const artifact = structuredClone(await readJson(ARTIFACT));
        const instance = artifact.instances.find(candidate => candidate.witness.steps.length);
        instance.witness.steps.at(-1).outputs[0].shape = 'WuWuWuWu';
        const file = path.join(directory, 'instances.json');
        await fs.writeFile(file, JSON.stringify(artifact));

        const result = await validateBenchmarkArtifact({
            releaseId: `${RELEASE_ID}-manifest-r2`, artifactPath: file, validateRelease: true,
        });
        assert.equal(result.valid, false);
        const joined = result.errors.join('\n');
        assert.match(joined, /instance sha256 mismatch|artifact sha256 mismatch/);
        assert.match(joined, /actual artifact canonical content differs from trusted release/);
    });
});

test('negative control 2: official target identity tampering is rejected', async () => {
    await withScratch(async directory => {
        const manifest = await readJson(path.join(ROOT, 'benchmarks/manifest.json'));
        manifest.cases[0].sha256 = 'f'.repeat(64);
        const file = path.join(directory, 'manifest.json');
        await fs.writeFile(file, JSON.stringify(manifest));

        const result = await validateBenchmarkArtifact({
            releaseId: RELEASE_ID, manifestPath: file, validateRelease: false,
        });
        assert.equal(result.valid, false);
        assert.match(result.errors.join('\n'), /official targets|differs from official source/);
    });
});

test('negative control 3: an illegal physics path is rejected by replay, not by hashes', async () => {
    await withScratch(async directory => {
        const artifact = structuredClone(await readJson(ARTIFACT));
        const instance = artifact.instances.find(candidate => candidate.witness.steps.length > 1);
        instance.witness.steps[1].outputs[0].shape = 'WuWuWuWu';

        // Semantic layer first: replay recomputes the operation and disagrees with the claim.
        const replay = replayWitness(instance, CATALOG);
        assert.equal(replay.valid, false, 'replay must recompute the declared output');
        assert.match(replay.errors.join('\n'), /declared outputs differ/);

        // Then the full validator, with every self-hash re-derived so no hash can preempt it.
        refreshSelfHashes(artifact);
        const file = path.join(directory, 'instances.json');
        await fs.writeFile(file, JSON.stringify(artifact));
        const result = await validateBenchmarkArtifact({
            releaseId: RELEASE_ID, artifactPath: file, validateRelease: false,
        });
        assert.equal(result.valid, false);
        const joined = result.errors.join('\n');
        assert.match(joined, /replay failed/, 'the rejection must be a replay failure');
        assert.doesNotMatch(joined, /instance sha256 mismatch|artifact sha256 mismatch/,
            'self-hashes were refreshed, so the rejection cannot be a hash mismatch');

        // And the deferral classifier must treat it as blocking. The only deferrable error
        // present is the semantics byte pin; the replay failure must never be classified.
        const allowed = new Map(state.files.filter(file => file.deferred).map(file => [file.path, file.current]));
        const { deferred, blocking } = classifySemanticsErrors(result.errors, allowed);
        assert.equal(deferred.every(item => item.path === 'shapeOperations.js'), true);
        assert.ok(blocking.some(message => /replay failed/.test(message)));
        assert.equal(blocking.some(message => /canonical semantics/.test(message)), false);
    });
});

test('deferred mode never accepts a game-semantics pin that is neither historical nor current', () => {
    const allowed = new Map([['shapeOperations.js', 'a'.repeat(64)]]);
    const message = `canonical semantics: shapeOperations.js: repository hash ${'b'.repeat(64)} differs from policy ${'c'.repeat(64)}`;
    const { deferred, blocking } = classifySemanticsErrors([message], allowed);
    assert.equal(deferred.length, 0, 'an unknown pin must not be classified as deferrable');
    assert.deepEqual(blocking, [message]);
    // The same message is deferrable only when it matches the current pin exactly.
    const matching = `canonical semantics: shapeOperations.js: repository hash ${'a'.repeat(64)} differs from policy ${'c'.repeat(64)}`;
    assert.equal(classifySemanticsErrors([matching], allowed).deferred.length, 1);
});
