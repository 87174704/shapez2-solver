// Separate diagnostic artifact; never invokes or writes the frozen baseline runner.
import process from 'node:process';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolveCases } from './solver-baseline-core.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'benchmarks/profiling/hard-53x3-architecture-v1');
const CHILD = path.join(ROOT, 'benchmarks/tools/profile-hard-53x3-case.mjs');
const BASE = path.join(ROOT, 'benchmarks/solver-baselines/hard-53x3-v1');
const FROZEN_BASELINE = 'a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661';
const FROZEN_BENCHMARK = '5836350ed30779f76fa32a6d4e9dce3628f7b5a554dfc4cb4e512c3b1ffe72db';
const SAMPLE = [
    ['hard-main-003', 'F1', 'ordinary candidate cap, lower states'],
    ['hard-main-007', 'F1', 'mixed pin/crystal and swapper candidate cap, very low states'],
    ['hard-side-017', 'F3', 'ordinary swapper-related candidate cap'],
    ['hard-side-040', 'F1', 'crystal swapper-related candidate cap'],
    ['hard-side-021', 'F1', 'family contrast, high states'],
    ['hard-side-021', 'F2', 'family contrast, middle states'],
    ['hard-side-021', 'F3', 'family contrast, low states'],
    ['hard-side-041', 'F3', 'ordinary shape-universe cap, shallower'],
    ['hard-side-013', 'F2', 'ordinary shape-universe cap, deeper'],
    ['hard-side-036', 'F1', 'pin shape-universe cap, shallow'],
    ['hard-side-028', 'F1', 'pin shape-universe cap, deep'],
    ['hard-main-010', 'F1', 'crystal shape-universe cap'],
    ['hard-side-035', 'F1', 'crystal shape-universe cap'],
    ['hard-side-036', 'F2', 'pin and swapper-related shape-universe cap, shallow'],
    ['hard-main-002', 'F2', 'ordinary swapper-related shape-universe cap, deeper'],
    ['hard-side-035', 'F3', 'timeout control'],
];
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

function runCase(input, statePath, sampleEvery) {
    return new Promise(resolve => {
        const child = spawn(process.execPath, [CHILD], {
            cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
        });
        let stdout = '';
        let stderr = '';
        let watchdog = false;
        const timer = setTimeout(() => { watchdog = true; child.kill(); }, 180000);
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', text => { stdout += text; });
        child.stderr.on('data', text => { stderr += text; });
        child.on('error', error => { stderr += error.stack ?? String(error); });
        child.on('close', (code, signal) => {
            clearTimeout(timer);
            if (watchdog) { resolve({ error: 'profile-watchdog', exitCode: code, signal }); return; }
            try { resolve({ ...JSON.parse(stdout), exitCode: code, stderr: stderr || null }); }
            catch { resolve({ error: 'invalid-profile-child-result', exitCode: code, stderr, stdout: stdout.slice(-1000) }); }
        });
        child.stdin.end(JSON.stringify({ input, sampleEvery, statePath }));
    });
}

async function main() {
    if (process.argv.includes('--help')) {
        process.stdout.write('Usage: node benchmarks/tools/profile-hard-53x3.mjs [--case targetId:F1] [--resume]\n');
        return;
    }
    const allowed = new Set(['--case', '--resume']);
    for (let i = 2; i < process.argv.length; i++) {
        const arg = process.argv[i];
        if (!allowed.has(arg)) throw new Error(`Unknown profiling option: ${arg}`);
        if (arg === '--case') i += 1;
    }
    const only = process.argv.indexOf('--case');
    const onlyCase = only >= 0 ? process.argv[only + 1] : null;
    const resume = process.argv.includes('--resume');
    const sampleEvery = 256;
    if (only >= 0 && !onlyCase) throw new Error('--case requires targetId:F1/F2/F3');
    const identity = await json(path.join(BASE, 'identity.json'));
    const config = await json(path.join(BASE, 'config.json'));
    if (identity.baselineCanonicalSha256 !== FROZEN_BASELINE
        || identity.benchmarkCanonicalSha256 !== FROZEN_BENCHMARK
        || config.solver.codeCanonicalSha256 !== identity.solverCodeCanonicalSha256) {
        throw new Error('Frozen baseline identity mismatch');
    }
    const sourceA = await readFile(path.join(ROOT, 'shapeSolver.js'));
    const sourceB = await readFile(path.join(ROOT, 'shapeSolver_web.js'));
    if (!sourceA.equals(sourceB)) throw new Error('Solver duplicate sources are not byte-identical');
    const instrumentedSolverSha256 = digest(sourceA);
    const manifest = await json(path.join(ROOT, 'benchmarks/releases/hard-53x3-stage-v1.release.json'));
    if (manifest.compositeCanonicalSha256 !== FROZEN_BENCHMARK) throw new Error('Release identity mismatch');
    const selection = await json(path.join(ROOT, manifest.bindings.finalSelection.path));
    const sourceDocuments = new Map(await Promise.all(manifest.sourceRegistry.map(async source =>
        [source.sourceId, await json(path.join(ROOT, source.path))])));
    const cases = resolveCases(manifest, selection, sourceDocuments);
    const byKey = new Map(cases.map(item => [`${item.targetId}:${item.familySlot}`, item]));
    const chosen = await Promise.all(SAMPLE.map(async ([targetId, familySlot, reason]) => {
        const key = `${targetId}:${familySlot}`;
        const item = byKey.get(key);
        if (!item) throw new Error(`Missing released case: ${key}`);
        const baseline = await json(path.join(BASE, 'records', `${targetId}-${familySlot}.json`));
        if (baseline.instanceId !== item.instanceId || baseline.sourceInstanceSha256 !== item.sourceInstanceSha256
            || baseline.structuralSignature !== item.structuralSignature
            || baseline.configCanonicalSha256 !== config.configCanonicalSha256) {
            throw new Error(`Baseline record identity mismatch: ${key}`);
        }
        return { key, reason, item, baseline: {
            status: baseline.status, wallMs: baseline.wallMs, statesExplored: baseline.statesExplored,
            candidatesGenerated: baseline.candidatesGenerated, maxSearchDepthReached: baseline.maxSearchDepthReached,
            instanceId: baseline.instanceId, sourceInstanceSha256: baseline.sourceInstanceSha256,
            structuralSignature: baseline.structuralSignature,
        } };
    }));
    if (onlyCase && !chosen.some(row => row.key === onlyCase)) throw new Error(`Not in fixed sample: ${onlyCase}`);
    await mkdir(path.join(OUT, 'records'), { recursive: true });
    await writeFile(path.join(OUT, 'sample.json'), `${JSON.stringify({
        schemaVersion: 1, benchmarkCanonicalSha256: FROZEN_BENCHMARK,
        baselineCanonicalSha256: FROZEN_BASELINE, instrumentedSolverSha256,
        sampleEveryExpandedState: sampleEvery,
        cases: chosen.map(({ key, reason, item, baseline }) => ({
            key, reason, targetId: item.targetId, familySlot: item.familySlot,
            instanceId: item.instanceId, sourceInstanceSha256: item.sourceInstanceSha256,
            structuralSignature: item.structuralSignature, mechanism: item.mechanism, baseline,
        })),
    }, null, 2)}\n`);
    for (const { key, item, baseline } of chosen) {
        if (onlyCase && key !== onlyCase) continue;
        const stem = `${item.targetId}-${item.familySlot}`;
        const recordPath = path.join(OUT, 'records', `${stem}.json`);
        if (resume) {
            try {
                const prior = await json(recordPath);
                if (prior.instrumentedSolverSha256 === instrumentedSolverSha256 && !prior.error) continue;
            } catch { /* Missing or invalid diagnostics are rerun. */ }
        }
        const statePath = path.join(OUT, 'records', `${stem}.states.ndjson`);
        const result = await runCase(item.input, statePath, sampleEvery);
        const logicalParity = !result.error && result.statesExplored === baseline.statesExplored
            && result.generatedStates === baseline.candidatesGenerated
            && result.depth === baseline.maxSearchDepthReached
            && (result.limitReason === 'generated-states' ? baseline.status === 'CANDIDATE_CAP'
                : result.limitReason === 'shape-universe' ? baseline.status === 'SHAPE_UNIVERSE_CAP'
                : result.limitReason === 'time' ? baseline.status === 'TIMEOUT' : false);
        await writeFile(recordPath, `${JSON.stringify({
            schemaVersion: 1, key, baselineCanonicalSha256: FROZEN_BASELINE,
            instrumentedSolverSha256, sampleEveryExpandedState: sampleEvery,
            sourceInstanceSha256: item.sourceInstanceSha256, logicalParity,
            diagnosticOnly: true, stateRows: path.relative(OUT, statePath).replaceAll('\\', '/'),
            ...result,
        }, null, 2)}\n`);
        process.stdout.write(`${key}: ${result.error ?? result.limitReason ?? result.outcome}, parity=${logicalParity}\n`);
    }
}

await main();
