import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    aggregateResults, atomicJson, baselineIdentity, canonicalHash, classifyResult, configHash,
    quantiles, resolveCases,
} from '../benchmarks/tools/solver-baseline-core.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function json(relative) { return JSON.parse(await readFile(path.join(ROOT, relative), 'utf8')); }

test('frozen composite members resolve to exact source inputs and metadata', async () => {
    const manifest = await json('benchmarks/releases/hard-53x3-stage-v1.release.json');
    const selection = await json(manifest.bindings.finalSelection.path);
    const sources = new Map(await Promise.all(manifest.sourceRegistry.map(async source => [source.sourceId, await json(source.path)])));
    const cases = resolveCases(manifest, selection, sources);
    assert.equal(cases.length, 159);
    assert.equal(new Set(cases.map(row => row.targetId)).size, 53);
    assert.deepEqual(Object.fromEntries(['baseline', 'retained-B', 'replacement'].map(category => [
        category, cases.filter(row => row.sourceCategory === category).length,
    ])), { baseline: 53, 'retained-B': 64, replacement: 42 });
    assert.deepEqual(Object.fromEntries(['B', 'C', 'D', 'E'].map(depth => [
        depth, cases.filter(row => row.depthClass === depth).length,
    ])), { B: 64, C: 1, D: 7, E: 34 });
    for (const row of cases) {
        assert.equal(row.input.maxStatesPerLevel, 3000);
        assert.equal(row.input.startingShapeCodes.length > 0, true);
        assert.equal(row.input.allowSplitting, false);
        assert.equal(row.input.cleanPainting, true);
        assert.equal(row.input.enabledOperations.length, 10);
    }
    assert.equal(cases[0].instanceId, 'hard-main-001-53x1-01');
    assert.equal(cases[0].input.startingShapeCodes.length, 10);
});

test('terminal status retains the actual Solver cause', () => {
    for (const [result, status] of [
        [{ outcome: 'solved', solutionPath: [] }, 'SOLVED'],
        [{ outcome: 'limit', limitReason: 'time' }, 'TIMEOUT'],
        [{ outcome: 'limit', limitReason: 'visited-states' }, 'STATE_CAP'],
        [{ outcome: 'limit', limitReason: 'generated-states' }, 'CANDIDATE_CAP'],
        [{ outcome: 'limit', limitReason: 'shape-universe' }, 'SHAPE_UNIVERSE_CAP'],
        [{ outcome: 'not-found-pruned' }, 'NOT_FOUND_PRUNED'],
        [{ outcome: 'exhausted' }, 'SEARCH_EXHAUSTED'],
        [{ outcome: 'unknown' }, 'ERROR'],
    ]) assert.equal(classifyResult(result).status, status);
});

test('canonical hashes ignore object key order and config creation time', () => {
    assert.equal(canonicalHash({ b: 2, a: 1 }), canonicalHash({ a: 1, b: 2 }));
    assert.equal(configHash({ createdAt: 'one', b: 2, a: 1 }), configHash({ createdAt: 'two', a: 1, b: 2 }));
    const config = {
        benchmark: { compositeCanonicalSha256: 'benchmark', finalSelectionCanonicalSha256: 'selection' },
        solver: { codeCanonicalSha256: 'solver' }, configCanonicalSha256: 'config',
    };
    const records = [{ targetId: 'target', familySlot: 'F1', instanceId: 'instance', status: 'TIMEOUT' }];
    const same = [{ status: 'TIMEOUT', instanceId: 'instance', familySlot: 'F1', targetId: 'target' }];
    assert.equal(baselineIdentity(config, records).baselineCanonicalSha256, baselineIdentity(config, same).baselineCanonicalSha256);
    assert.notEqual(baselineIdentity(config, records).baselineCanonicalSha256,
        baselineIdentity(config, [{ ...records[0], status: 'SOLVED' }]).baselineCanonicalSha256);
});

test('atomic JSON replacement works for repeated resume checkpoints', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'shapez-baseline-atomic-'));
    try {
        const target = path.join(directory, 'resume-state.json');
        await atomicJson(target, { completed: 1 });
        await atomicJson(target, { completed: 2 });
        assert.deepEqual(JSON.parse(await readFile(target, 'utf8')), { completed: 2 });
    } finally {
        if (path.basename(directory).startsWith('shapez-baseline-atomic-')) {
            await rm(directory, { recursive: true, force: true });
        }
    }
});

test('aggregation covers 159 outcomes, target family counts, mechanism and cost quantiles', () => {
    const cases = [];
    const records = [];
    const pattern = [3, 2, 1, 0];
    for (let target = 0; target < 53; target++) {
        for (let family = 0; family < 3; family++) {
            const targetId = `target-${target}`;
            const familySlot = `F${family + 1}`;
            const instanceId = `${targetId}-${familySlot}`;
            cases.push({ targetId, familySlot, instanceId, track: 'main',
                sourceCategory: family === 0 ? 'baseline' : family === 1 ? 'retained-B' : 'replacement',
                depthClass: family === 0 ? null : family === 1 ? 'B' : 'E',
                mechanism: { mechanismClass: 'ordinary', ordinaryOnly: true, pin: false,
                    crystal: false, mixedPinCrystal: false, swapperRelated: false, refinementGroup: null } });
            const status = family < pattern[target % 4] ? 'SOLVED' : 'CANDIDATE_CAP';
            records.push({ targetId, familySlot, instanceId, status,
                wallMs: target + 1, cpuMs: target + 1, statesExplored: target + 1,
                candidatesGenerated: target + 1, maxSearchDepthReached: family + 1,
                peakRssMiB: 100 + target });
        }
    }
    const aggregate = aggregateResults(cases, records);
    assert.equal(aggregate.total.count, 159);
    assert.equal(Object.values(aggregate.targetSolvedCounts).reduce((a, b) => a + b), 53);
    assert.equal(aggregate.targetSolvedCounts['3/3'], 14);
    assert.equal(aggregate.targetSolvedCounts['0/3'], 13);
    assert.equal(aggregate.total.byStatus.SOLVED + aggregate.total.byStatus.CANDIDATE_CAP, 159);
    assert.equal(aggregate.byMechanism['class:ordinary'].count, 159);
    assert.equal(aggregate.costs.solved.wallMs.count, aggregate.total.solved);
    assert.deepEqual(quantiles([1, 2, 3, 4, 5]), { count: 5, min: 1, median: 3, p90: 4.6, p95: 4.8, max: 5 });
});
