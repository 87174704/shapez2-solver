// P6-03 measurement only. Never writes to the frozen baseline or P6-02 profile.
import process from 'node:process';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolveCases } from './solver-baseline-core.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'benchmarks/profiling/hard-53x3-p6-03-v1');
const BASE = path.join(ROOT, 'benchmarks/solver-baselines/hard-53x3-v1');
const SAMPLE = path.join(ROOT, 'benchmarks/profiling/hard-53x3-architecture-v1/sample.json');
const CHILD = path.join(ROOT, 'benchmarks/tools/p6-03-observer-case.mjs');
const BENCHMARK_HASH = '5836350ed30779f76fa32a6d4e9dce3628f7b5a554dfc4cb4e512c3b1ffe72db';
const BASELINE_HASH = 'a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async file => JSON.parse(await readFile(file, 'utf8'));

async function existingJson(file) {
    try { return await json(file); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function runChild(input, mode) {
    return new Promise(resolve => {
        const child = spawn(process.execPath, ['--expose-gc', CHILD], {
            cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
        });
        let stdout = '';
        let stderr = '';
        let watchdog = false;
        const timer = setTimeout(() => { watchdog = true; child.kill(); }, 180000);
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', chunk => { stdout += chunk; });
        child.stderr.on('data', chunk => { stderr += chunk; });
        child.on('error', error => { stderr += error.stack ?? String(error); });
        child.on('close', (exitCode, signal) => {
            clearTimeout(timer);
            if (watchdog) { resolve({ mode, error: 'measurement-watchdog', exitCode, signal }); return; }
            try { resolve({ ...JSON.parse(stdout), exitCode, stderr: stderr || null }); }
            catch { resolve({ mode, error: 'invalid-child-result', exitCode,
                stderr, stdoutTail: stdout.slice(-1000) }); }
        });
        child.stdin.end(JSON.stringify({ input, mode }));
    });
}

function logical(run) {
    return { outcome: run.outcome, limitReason: run.limitReason, depth: run.depth,
        statesExplored: run.statesExplored, generatedStates: run.generatedStates,
        beamPruned: run.beamPruned, solutionSignature: run.solutionSignature };
}

function verifyRun(run, baseline, key) {
    if (run.error || run.exitCode !== 0) throw new Error(`${key} ${run.mode}: ${run.error ?? run.stderr ?? `exit ${run.exitCode}`}`);
    const expected = { outcome: 'limit', limitReason: 'shape-universe',
        depth: baseline.maxSearchDepthReached, statesExplored: baseline.statesExplored,
        generatedStates: baseline.candidatesGenerated, beamPruned: baseline.beamPruned,
        solutionSignature: null };
    if (JSON.stringify(logical(run)) !== JSON.stringify(expected)) {
        throw new Error(`${key} ${run.mode}: frozen logical signature mismatch: ${JSON.stringify(logical(run))}`);
    }
}

function summarize(records, identities, sourceHash) {
    const totals = {
        operationOutputBirths: 0, unmaterializedAtOriginalCap: 0,
        candidateMaterialized: 0, admitted: 0, finalRetained: 0, expanded: 0,
        d024ShapeSlots: 0, descriptorPayloadUtf16Bytes: 0,
    };
    const cases = records.map(record => {
        const obs = record.observer.observation;
        totals.operationOutputBirths += obs.operationOutputBirths;
        totals.unmaterializedAtOriginalCap += obs.unmaterializedAtOriginalCap.count;
        totals.candidateMaterialized += obs.candidateMaterialized.count;
        totals.admitted += obs.admitted.count;
        totals.finalRetained += obs.finalRetained.count;
        totals.expanded += obs.expanded.count;
        totals.d024ShapeSlots += obs.d024ShapeSlots;
        totals.descriptorPayloadUtf16Bytes += obs.descriptorPayloadUtf16Bytes;
        return { key: record.key, order: record.order,
            operationOutputBirths: obs.operationOutputBirths,
            unmaterializedAtOriginalCap: obs.unmaterializedAtOriginalCap.count,
            wallDeltaMs: record.delta.observerMinusPlainWallMs,
            peakRssDeltaMiB: record.delta.observerMinusPlainPeakRssMiB };
    });
    return { schemaVersion: 1, status: records.length === 8 ? 'complete' : 'partial',
        ...identities, currentSolverSha256: sourceHash,
        runtime: { node: process.version, platform: process.platform, arch: process.arch },
        completedCases: records.length, expectedCases: 8, totals, cases,
        interpretation: {
            unmaterializedAtOriginalCap: 'Counterfactual identity demand through the original cap only; not a D-024 compliant cap extension',
            descriptorPayloadUtf16Bytes: 'UTF-16 code-unit payload proxy; excludes JS object, Map, and allocator overhead',
            rssDelta: 'Fresh-process high-water Node RSS; a single alternating A/B run per case is descriptive, not a stable speed or browser-memory estimate',
        } };
}

async function main() {
    if (process.argv.includes('--help')) {
        process.stdout.write('Usage: node benchmarks/tools/run-hard-53x3-p6-03-observer.mjs [--case targetId:F1|F2|F3] [--resume]\n');
        return;
    }
    const allowed = new Set(['--case', '--resume']);
    for (let i = 2; i < process.argv.length; i++) {
        const arg = process.argv[i];
        if (!allowed.has(arg)) throw new Error(`Unknown P6-03 option: ${arg}`);
        if (arg === '--case') i += 1;
    }
    const onlyIndex = process.argv.indexOf('--case');
    const onlyCase = onlyIndex >= 0 ? process.argv[onlyIndex + 1] : null;
    if (onlyIndex >= 0 && (!onlyCase || onlyCase.startsWith('--'))) throw new Error('--case requires targetId:F1/F2/F3');
    const resume = process.argv.includes('--resume');
    const sampleBytes = await readFile(SAMPLE);
    const sample = JSON.parse(sampleBytes);
    const identity = await json(path.join(BASE, 'identity.json'));
    const config = await json(path.join(BASE, 'config.json'));
    const release = await json(path.join(ROOT, 'benchmarks/releases/hard-53x3-stage-v1.release.json'));
    if (identity.baselineCanonicalSha256 !== BASELINE_HASH
        || identity.benchmarkCanonicalSha256 !== BENCHMARK_HASH
        || config.configCanonicalSha256 !== identity.configCanonicalSha256
        || release.compositeCanonicalSha256 !== BENCHMARK_HASH
        || sample.baselineCanonicalSha256 !== BASELINE_HASH
        || sample.benchmarkCanonicalSha256 !== BENCHMARK_HASH) {
        throw new Error('Frozen benchmark/baseline/P6-02 identity mismatch');
    }
    const sourceA = await readFile(path.join(ROOT, 'shapeSolver.js'));
    const sourceB = await readFile(path.join(ROOT, 'shapeSolver_web.js'));
    if (!sourceA.equals(sourceB)) throw new Error('Solver copies are not byte-identical');
    const currentSolverSha256 = digest(sourceA);
    const runnerSha256 = digest(await readFile(fileURLToPath(import.meta.url)));
    const childSha256 = digest(await readFile(CHILD));
    const selection = await json(path.join(ROOT, release.bindings.finalSelection.path));
    const sourceDocuments = new Map(await Promise.all(release.sourceRegistry.map(async source =>
        [source.sourceId, await json(path.join(ROOT, source.path))])));
    const resolved = resolveCases(release, selection, sourceDocuments);
    const byKey = new Map(resolved.map(row => [`${row.targetId}:${row.familySlot}`, row]));
    const shapeRows = sample.cases.filter(row => row.baseline.status === 'SHAPE_UNIVERSE_CAP');
    if (shapeRows.length !== 8 || new Set(shapeRows.map(row => row.key)).size !== 8) {
        throw new Error('P6-02 fixed shape-cap cohort is not exactly eight unique cases');
    }
    if (onlyCase && !shapeRows.some(row => row.key === onlyCase)) throw new Error(`Not a fixed shape-cap case: ${onlyCase}`);
    const identities = { benchmarkCanonicalSha256: BENCHMARK_HASH,
        baselineCanonicalSha256: BASELINE_HASH,
        p602SampleSha256: digest(sampleBytes),
        p602InstrumentedSolverSha256: sample.instrumentedSolverSha256,
        runnerSha256, childSha256 };
    await mkdir(path.join(OUT, 'records'), { recursive: true });
    for (let index = 0; index < shapeRows.length; index++) {
        const row = shapeRows[index];
        if (onlyCase && row.key !== onlyCase) continue;
        const item = byKey.get(row.key);
        const baseline = await json(path.join(BASE, 'records', `${row.targetId}-${row.familySlot}.json`));
        if (!item || item.instanceId !== row.instanceId
            || item.sourceInstanceSha256 !== row.sourceInstanceSha256
            || item.structuralSignature !== row.structuralSignature
            || baseline.instanceId !== row.instanceId
            || baseline.sourceInstanceSha256 !== row.sourceInstanceSha256
            || baseline.structuralSignature !== row.structuralSignature
            || baseline.configCanonicalSha256 !== config.configCanonicalSha256
            || baseline.status !== 'SHAPE_UNIVERSE_CAP') {
            throw new Error(`Released membership or frozen record mismatch: ${row.key}`);
        }
        const recordPath = path.join(OUT, 'records', `${row.targetId}-${row.familySlot}.json`);
        const prior = await existingJson(recordPath);
        if (prior) {
            if (!resume) throw new Error(`Existing P6-03 record requires --resume: ${recordPath}`);
            if (prior.key !== row.key || prior.currentSolverSha256 !== currentSolverSha256
                || prior.baselineCanonicalSha256 !== BASELINE_HASH
                || prior.benchmarkCanonicalSha256 !== BENCHMARK_HASH
                || prior.runnerSha256 !== runnerSha256
                || prior.childSha256 !== childSha256
                || prior.sourceInstanceSha256 !== row.sourceInstanceSha256
                || prior.instanceId !== row.instanceId
                || prior.structuralSignature !== row.structuralSignature
                || prior.logicalParity !== true) {
                throw new Error(`Existing P6-03 record identity/parity mismatch: ${row.key}`);
            }
            verifyRun(prior.plain, baseline, row.key);
            verifyRun(prior.observer, baseline, row.key);
            if (JSON.stringify(logical(prior.plain)) !== JSON.stringify(logical(prior.observer))) {
                throw new Error(`Existing P6-03 record A/B mismatch: ${row.key}`);
            }
            process.stdout.write(`${row.key}: already measured\n`);
            continue;
        }
        const order = index % 2 === 0 ? ['plain', 'observer'] : ['observer', 'plain'];
        const runs = {};
        for (const mode of order) {
            runs[mode] = await runChild(item.input, mode);
            verifyRun(runs[mode], baseline, row.key);
        }
        if (JSON.stringify(logical(runs.plain)) !== JSON.stringify(logical(runs.observer))) {
            throw new Error(`${row.key}: observer changed logical result`);
        }
        const record = { schemaVersion: 1, key: row.key, targetId: row.targetId,
            familySlot: row.familySlot, instanceId: row.instanceId,
            sourceInstanceSha256: row.sourceInstanceSha256,
            structuralSignature: row.structuralSignature,
            ...identities, currentSolverSha256, order, logicalParity: true,
            plain: runs.plain, observer: runs.observer,
            delta: { observerMinusPlainWallMs: runs.observer.wallMs - runs.plain.wallMs,
                observerMinusPlainPeakRssMiB: runs.observer.peakRssMiB - runs.plain.peakRssMiB } };
        await writeFile(recordPath, `${JSON.stringify(record, null, 2)}\n`);
        process.stdout.write(`${row.key}: ${runs.plain.limitReason}, parity=true\n`);
    }
    const records = [];
    for (const row of shapeRows) {
        const record = await existingJson(path.join(OUT, 'records', `${row.targetId}-${row.familySlot}.json`));
        if (!record) continue;
        if (record.currentSolverSha256 !== currentSolverSha256 || record.logicalParity !== true
            || record.key !== row.key || record.instanceId !== row.instanceId
            || record.sourceInstanceSha256 !== row.sourceInstanceSha256
            || record.structuralSignature !== row.structuralSignature
            || record.baselineCanonicalSha256 !== BASELINE_HASH
            || record.benchmarkCanonicalSha256 !== BENCHMARK_HASH
            || record.p602SampleSha256 !== identities.p602SampleSha256) {
            throw new Error(`P6-03 analysis record mismatch: ${row.key}`);
        }
        records.push(record);
    }
    await writeFile(path.join(OUT, 'analysis.json'),
        `${JSON.stringify(summarize(records, identities, currentSolverSha256), null, 2)}\n`);
}

await main();
