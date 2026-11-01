import { verifyRelease } from '../../versions/release1.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import os from 'node:os';
import { ROOT, json, sha256, verifyVersion } from '../../versions/identity.mjs';

// Historical Physics v2 RC measurement only. It re-measures the Release 1 / v1 pair and is
// not part of the current maintenance gate (scripts/ci/verify-current.mjs). The evidence
// directory is explicit: the tool never defaults to a repository path, and it never writes
// anything before its identity checks pass.
const USAGE = 'Usage: node tests/tools/measurePhysicsV2.mjs <evidence-dir> [historical-v1-root]';
if (process.argv[2] === '--help') { console.log(USAGE); process.exit(0); }
if (!process.argv[2]) {
    console.error(`${USAGE}\nAn explicit evidence directory containing acceptance.json is required.`);
    process.exit(1);
}
const OUT = path.resolve(process.argv[2]);
const historicalRoot = path.resolve(process.argv[3] ?? path.join(os.tmpdir(), 'shapez2-physics-v2-v1'));
const worker = process.argv[4] === '--worker';
function refuse(label, result) {
    const errors = result.errors ?? [];
    console.error(`measure:physics-v2: refusing to run; this is not the historical ${label} identity.`);
    console.error(errors.slice(0, 10).join('\n'));
    if (errors.length > 10) console.error(`... ${errors.length - 10} more error(s)`);
    console.error('Nothing was written. The current maintenance gate is scripts/ci/verify-current.mjs.');
    process.exit(1);
}
if (worker) {
    const version = process.argv[5], destination = process.argv[6];
    const root = version === 'v1' ? historicalRoot : ROOT;
    const identity = version === 'v1' ? await verifyVersion({ version: 'shape-operations-v1', root }) : await verifyRelease({ root });
    if (!identity.valid) refuse(version === 'v1' ? 'v1' : 'Release 1', identity);
    const base = await json(path.join(OUT, 'acceptance.json'));
    assert.equal(typeof globalThis.gc, 'function');
    globalThis.self = { postMessage() {} };
    const importStart = performance.now();
    const { shapeSolver } = await import(pathToFileURL(path.join(root, 'shapeSolver.js')));
    const moduleImportMs = performance.now() - importStart;
    async function run(label) {
        const rows = [], start = performance.now();
        for (const c of base.cases) {
            const p = c.input, t = performance.now();
            const r = await shapeSolver(p.targetShapeCodes, p.startingShapeCodes, p.enabledOperations, 4, 3000, false, false, false, true);
            const elapsedMs = performance.now() - t;
            assert.deepEqual(r.solutionPath, c.result.solutionPath);
            rows.push({ caseId: c.caseId, elapsedMs, statesExplored: r.statesExplored, generatedStates: r.generatedStates,
                depth: r.depth, route: r.solverRoute, pathSha256: sha256(JSON.stringify(r.solutionPath)) });
        }
        return { label, wallMs: performance.now() - start, solveMs: rows.reduce((n, r) => n + r.elapsedMs, 0), rows };
    }
    const cold = await run('cold-first-batch');
    await run('warmup-discarded');
    const rounds = [];
    for (let round = 0; round < 2; round++) { globalThis.gc(); rounds.push(await run(`warm-${round + 1}`)); }
    await fs.writeFile(destination, JSON.stringify({ version, identity, node: process.version, platform: process.platform,
        arch: process.arch, moduleImportMs, cold, rounds, resourceUsage: process.resourceUsage() }, null, 2) + '\n');
} else {
    const identity = await verifyRelease();
    if (!identity.valid) refuse('Release 1', identity);
    const historicalIdentity = await verifyVersion({ version: 'shape-operations-v1', root: historicalRoot });
    if (!historicalIdentity.valid) refuse('v1', historicalIdentity);
    const base = await json(path.join(OUT, 'acceptance.json'));
    const runs = [];
    for (let pair = 0; pair < 3; pair++) {
        const order = pair % 2 ? ['v2', 'v1'] : ['v1', 'v2'];
        const row = { pair: pair + 1, order };
        for (const version of order) {
            const destination = path.join(OUT, `paired-${pair + 1}-${version}.json`);
            const child = spawn(process.execPath, ['--expose-gc', path.join(ROOT, 'tests/tools/measurePhysicsV2.mjs'), OUT, historicalRoot, '--worker', version, destination], { stdio: 'inherit' });
            const code = await new Promise(resolve => child.on('exit', resolve)); assert.equal(code, 0);
            row[version] = await json(destination);
            console.log(`performance pair ${pair + 1}/3 ${version} complete`);
        }
        for (let i = 0; i < 2; i++) for (let c = 0; c < base.cases.length; c++) {
            const a = row.v1.rounds[i].rows[c], b = row.v2.rounds[i].rows[c];
            for (const k of ['caseId', 'statesExplored', 'generatedStates', 'depth', 'route', 'pathSha256']) assert.equal(a[k], b[k], k);
        }
        runs.push(row);
    }
    const quantile = (a, p) => { const s = [...a].sort((a, b) => a - b), i = (s.length - 1) * p, lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };
    function stats(a) {
        const q1 = quantile(a, .25), q3 = quantile(a, .75), median = quantile(a, .5), iqr = q3 - q1;
        return { n: a.length, median, q1, q3, iqr, mad: quantile(a.map(x => Math.abs(x - median)), .5), min: Math.min(...a), max: Math.max(...a),
            outliers: a.filter(x => x < q1 - 1.5 * iqr || x > q3 + 1.5 * iqr) };
    }
    const totals = version => runs.flatMap(r => r[version].rounds.map(x => x.solveMs));
    const deltas = runs.flatMap(r => r.v1.rounds.map((a, i) => (r.v2.rounds[i].solveMs / a.solveMs - 1) * 100));
    const perCase = base.cases.map((c, i) => ({ caseId: c.caseId,
        v1: stats(runs.flatMap(r => r.v1.rounds.map(x => x.rows[i].elapsedMs))),
        v2: stats(runs.flatMap(r => r.v2.rounds.map(x => x.rows[i].elapsedMs))) }));
    const report = { method: 'Three alternating process pairs; identical 159 inputs and public parameters; cold first batch, full discarded warmup, then two measured batches per process. No observation hooks.',
        limitations: 'Module import and cold solve separated. Solve time includes planning/search; runtime exports no pure-search-only clock. Process launch overhead is not attributed to search. Six batches/version in three process pairs are not independent proof of stable performance.',
        environment: { node: process.version, platform: process.platform, arch: process.arch, cpu: os.cpus()[0]?.model, cores: os.cpus().length },
        v1: stats(totals('v1')), v2: stats(totals('v2')), pairedDeltaPercent: stats(deltas),
        coldV1: stats(runs.map(r => r.v1.cold.solveMs)), coldV2: stats(runs.map(r => r.v2.cold.solveMs)),
        importV1: stats(runs.map(r => r.v1.moduleImportMs)), importV2: stats(runs.map(r => r.v2.moduleImportMs)),
        stablePerformanceChange: 'UNKNOWN', searchScaleEqual: true, perCase,
        pairs: runs.map(r => ({ pair: r.pair, order: r.order, v1: r.v1.rounds.map(x => x.solveMs), v2: r.v2.rounds.map(x => x.solveMs) })) };
    await fs.writeFile(path.join(OUT, 'performance-summary.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ v1: report.v1, v2: report.v2, pairedDeltaPercent: report.pairedDeltaPercent, conclusion: 'UNKNOWN' }));
}
