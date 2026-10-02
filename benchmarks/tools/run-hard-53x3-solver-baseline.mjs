#!/usr/bin/env node
import { spawn, execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { readJson, sha256 } from './benchmark-core.mjs';
import { validateCompositeRelease } from './validate-composite-release.mjs';
import {
    BASELINE_ID, BASELINE_RUNNER_VERSION, aggregateResults, atomicJson, baselineIdentity,
    canonicalHash, configHash, resolveCases,
} from './solver-baseline-core.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_OUTPUT = path.join(ROOT, 'benchmarks/solver-baselines/hard-53x3-v1');
const WORKER = path.join(ROOT, 'benchmarks/tools/solver-baseline-case.mjs');
const EXTERNAL_WATCHDOG_MS = 135000;
const EXPECTED_RELEASE = '5836350ed30779f76fa32a6d4e9dce3628f7b5a554dfc4cb4e512c3b1ffe72db';
const EXPECTED_SELECTION = '6e3efdece360e8dd338a49dd3edd8fe10620b288aa161d35a8d01ab966e1b47f';

function options(args) {
    let outputDir = DEFAULT_OUTPUT;
    let prepareOnly = false;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--help') return { help: true };
        if (args[i] === '--prepare-only') prepareOnly = true;
        else if (args[i] === '--output-dir' && args[i + 1]) outputDir = path.resolve(args[++i]);
        else throw new Error(`Unknown or incomplete argument: ${args[i]}`);
    }
    return { outputDir, prepareOnly };
}

async function sourceHash(relativePath) {
    return sha256(await readFile(path.join(ROOT, relativePath)));
}

function gitText(args) {
    try { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
    catch { return null; }
}

function gitBytes(args) {
    try { return execFileSync('git', args, { cwd: ROOT, maxBuffer: 32 * 1024 * 1024 }); }
    catch { return null; }
}

function npmVersion() {
    try {
        const command = process.platform === 'win32' ? 'cmd.exe' : 'npm';
        const args = process.platform === 'win32' ? ['/d', '/s', '/c', 'npm --version'] : ['--version'];
        return execFileSync(command, args, { cwd: ROOT, encoding: 'utf8' }).trim();
    } catch { return null; }
}

async function identities() {
    const solverFiles = [
        'shapeSolver.js', 'shapeSolver_web.js', 'shapeOperations.js', 'shapeConstants.js',
    ];
    const solverHashes = Object.fromEntries(await Promise.all(solverFiles.map(async file => [file, await sourceHash(file)])));
    if (solverHashes['shapeSolver.js'] !== solverHashes['shapeSolver_web.js']) {
        throw new Error('Solver production and web copies are not byte-identical');
    }
    const runnerFiles = [
        'benchmarks/tools/run-hard-53x3-solver-baseline.mjs',
        'benchmarks/tools/solver-baseline-core.mjs',
        'benchmarks/tools/solver-baseline-case.mjs',
        'tests/helpers/shapeSolverOracle.mjs',
    ];
    const runnerHashes = Object.fromEntries(await Promise.all(runnerFiles.map(async file => [file, await sourceHash(file)])));
    return {
        solver: {
            gitCommit: gitText(['rev-parse', 'HEAD']),
            sourceHashes: solverHashes, codeCanonicalSha256: canonicalHash(solverHashes),
        },
        runner: { version: BASELINE_RUNNER_VERSION, sourceHashes: runnerHashes, codeCanonicalSha256: canonicalHash(runnerHashes) },
    };
}

function frozenConfig(validation, identity) {
    const status = gitText(['status', '--porcelain=v1', '--untracked-files=all']);
    const trackedDiff = gitBytes(['diff', '--binary', 'HEAD']);
    return {
        schemaVersion: 1, baselineId: BASELINE_ID, createdAt: new Date().toISOString(),
        benchmark: {
            releaseId: validation.summary.compositeReleaseId,
            manifestRevisionId: validation.summary.manifestRevisionId,
            compositeCanonicalSha256: validation.summary.compositeCanonicalSha256,
            finalSelectionCanonicalSha256: validation.summary.finalSelectionCanonicalSha256,
            memberCount: validation.summary.memberCount,
        },
        solver: identity.solver, runner: identity.runner,
        workingTreeAtFreeze: {
            head: identity.solver.gitCommit,
            trackedDiffSha256: trackedDiff === null ? null : sha256(trackedDiff),
            statusSha256: status === null ? null : sha256(status),
            statusEntryCount: status ? status.split(/\r?\n/).length : 0,
        },
        runtime: {
            node: process.version, npm: npmVersion(), v8: process.versions.v8, platform: process.platform,
            arch: process.arch, osRelease: os.release(), cpuModel: os.cpus()[0]?.model ?? null,
            logicalCpuCount: os.cpus().length, totalMemoryBytes: os.totalmem(),
            nodeExecPath: process.execPath, nodeArgs: ['--expose-gc'],
            browser: { used: false, version: null, reason: 'production Solver module run in isolated Node process' },
        },
        configuration: {
            targetShapeCodes: 'singleton source-instance target',
            startingShapeCodes: 'source-instance availableInputs expanded by count in recorded row order',
            enabledOperations: 'all ten production recipe operations in Solver declaration order',
            maxLayers: 4, maxStatesPerLevel: 3000,
            preventWaste: false, orientationSensitive: false,
            allowSplitting: false, cleanPainting: true,
            internalLimits: {
                maxTotalStates: 500000, maxFrontierStates: 5000,
                maxGeneratedStates: 5000000, maxInternedShapes: 150000,
                maxSearchTimeMs: 120000, operationTimeCheckInterval: 2048,
            },
            searchDepthLimit: null, memoryLimitBytes: null,
            randomSeedPolicy: 'no Solver RNG or seed',
            workerCount: 1, concurrency: 1, externalWatchdogMs: EXTERNAL_WATCHDOG_MS,
            executionPath: 'fresh Node process importing production shapeSolver.js',
        },
    };
}

async function prepare(outputDir) {
    const validation = await validateCompositeRelease();
    if (!validation.valid || validation.summary.status !== 'released'
        || validation.summary.compositeCanonicalSha256 !== EXPECTED_RELEASE
        || validation.summary.finalSelectionCanonicalSha256 !== EXPECTED_SELECTION
        || validation.summary.provenanceResolved !== 159
        || validation.summary.mechanicallyReplayed !== 159
        || validation.summary.expansionValidated !== 159
        || validation.summary.fingerprintsValidated !== 159
        || validation.summary.targetCount !== 53) {
        throw new Error(`Frozen composite release validation failed: ${validation.errors.join('; ') || JSON.stringify(validation.summary)}`);
    }
    const manifest = validation.manifest;
    const selection = await readJson(path.join(ROOT, manifest.bindings.finalSelection.path));
    const sourceDocuments = new Map(await Promise.all(manifest.sourceRegistry.map(async source => [
        source.sourceId, await readJson(path.join(ROOT, source.path)),
    ])));
    const cases = resolveCases(manifest, selection, sourceDocuments);
    const identity = await identities();
    const draft = frozenConfig(validation, identity);
    const configPath = path.join(outputDir, 'config.json');
    let config;
    try {
        config = await readJson(configPath);
        if (config.configCanonicalSha256 !== configHash(config)) throw new Error('Existing config canonical hash is invalid');
        const { createdAt: _previous, configCanonicalSha256: _hash,
            workingTreeAtFreeze: _frozenTree, ...existingIdentity } = config;
        const { createdAt: _current, workingTreeAtFreeze: _currentTree, ...currentIdentity } = draft;
        if (canonicalHash(existingIdentity) !== canonicalHash(currentIdentity)) {
            throw new Error('Frozen config, runtime, Solver, runner, or benchmark identity changed');
        }
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        config = { ...draft, configCanonicalSha256: configHash(draft) };
        await mkdir(outputDir, { recursive: true });
        await atomicJson(configPath, config);
    }
    await mkdir(path.join(outputDir, 'records'), { recursive: true });
    return { config, cases, validation };
}

function recordPath(outputDir, item) {
    return path.join(outputDir, 'records', `${item.targetId}-${item.familySlot}.json`);
}

function validateRecord(record, item, config) {
    if (record.targetId !== item.targetId || record.familySlot !== item.familySlot
        || record.instanceId !== item.instanceId
        || record.structuralSignature !== item.structuralSignature
        || record.familyIdentity !== item.familyIdentity
        || record.sourceCategory !== item.sourceCategory
        || record.selectionCategory !== item.selectionCategory
        || record.sourceArtifact !== item.sourceArtifact
        || record.sourceId !== item.sourceId
        || record.depthClass !== item.depthClass
        || record.track !== item.track
        || canonicalHash(record.mechanism) !== canonicalHash(item.mechanism)
        || record.witnessDepth !== item.witnessDepth
        || record.configCanonicalSha256 !== config.configCanonicalSha256
        || record.sourceInstanceSha256 !== item.sourceInstanceSha256
        || record.recordCanonicalSha256 !== canonicalHash(Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'recordCanonicalSha256')))) {
        throw new Error(`Resume record identity mismatch: ${item.targetId}:${item.familySlot}`);
    }
}

function runFreshCase(item) {
    return new Promise(resolve => {
        const started = performance.now();
        const child = spawn(process.execPath, ['--expose-gc', WORKER], {
            cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe', 'ipc'], windowsHide: true,
        });
        let stdout = '';
        let stderr = '';
        let latestProgress = null;
        let sampledFrontierPeak = null;
        let timedOut = false;
        let settled = false;
        const finish = value => { if (!settled) { settled = true; clearTimeout(watchdog); resolve(value); } };
        const watchdog = setTimeout(() => { timedOut = true; child.kill(); }, EXTERNAL_WATCHDOG_MS);
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', chunk => { stdout += chunk; });
        child.stderr.on('data', chunk => { stderr = `${stderr}${chunk}`.slice(-8000); });
        child.on('message', message => {
            if (message?.type !== 'progress') return;
            latestProgress = message.progress;
            if (Number.isFinite(latestProgress.frontierSize)) {
                sampledFrontierPeak = Math.max(sampledFrontierPeak ?? 0, latestProgress.frontierSize);
            }
        });
        child.on('error', error => finish({ status: 'ERROR', solved: false, terminationReason: 'child-process-error', exception: error.message }));
        child.on('close', (code, signal) => {
            const externalWallMs = performance.now() - started;
            if (timedOut) {
                finish({
                    status: 'TIMEOUT', solved: false, terminationReason: 'external-watchdog',
                    wallMs: externalWallMs, cpuMs: null, peakRssMiB: latestProgress?.peakRssMiB ?? null,
                    statesExplored: latestProgress?.statesExplored ?? null,
                    candidatesGenerated: latestProgress?.candidatesGenerated ?? null,
                    maxSearchDepthReached: latestProgress?.depth ?? null,
                    lastMeaningfulDepth: latestProgress?.depth ?? null,
                    lastFrontierSize: latestProgress?.frontierSize ?? null,
                    sampledFrontierPeak,
                    beamPruned: latestProgress?.beamPruned ?? null,
                    latestProgress, exception: null, exitCode: code, signal,
                    availability: { cpuMs: 'unavailable: watchdog killed process', peakRssMiB: 'latest progress sample or unavailable' },
                });
                return;
            }
            if (code !== 0) {
                const memory = /heap out of memory|allocation failed|Reached heap limit/i.test(stderr);
                finish({ status: memory ? 'MEMORY_LIMIT' : 'ERROR', solved: false,
                    terminationReason: memory ? 'node-heap-oom' : 'child-process-exit',
                    wallMs: externalWallMs, cpuMs: null, peakRssMiB: latestProgress?.peakRssMiB ?? null,
                    latestProgress, exception: stderr || `exit=${code} signal=${signal}`, exitCode: code, signal });
                return;
            }
            try { finish(JSON.parse(stdout)); }
            catch (error) { finish({ status: 'ERROR', solved: false, terminationReason: 'invalid-child-result',
                wallMs: externalWallMs, exception: `${error.message}; stderr=${stderr}; stdout=${stdout.slice(-1000)}` }); }
        });
        child.stdin.end(JSON.stringify({ input: item.input }));
    });
}

function completedRecord(item, config, outcome) {
    const unavailable = {
        solverOutcome: null, limitReason: null,
        wallMs: null, cpuMs: null, cpuUserMs: null, cpuSystemMs: null,
        statesExplored: null, statesGenerated: null, statesRetained: null,
        sampledFrontierPeak: null,
        candidatesGenerated: null, candidatesEvaluated: null, candidatesPruned: null,
        maxSearchDepthReached: null, searchIterations: null,
        peakRssMiB: null, workerMemoryMiB: null,
        stateCapUsage: null, candidateCapUsage: null,
        operationCount: null, solutionDepth: null,
        replayValid: null, targetVerified: null, replayError: null,
        terminalSearchStage: null, capHit: null,
        lastMeaningfulDepth: null, lastFrontierSize: null,
        dominantRejectionReason: null, beamPruned: null,
        exception: null, availability: {},
    };
    const record = {
        targetId: item.targetId, familySlot: item.familySlot, instanceId: item.instanceId,
        structuralSignature: item.structuralSignature, familyIdentity: item.familyIdentity,
        sourceCategory: item.sourceCategory, selectionCategory: item.selectionCategory,
        sourceArtifact: item.sourceArtifact, sourceId: item.sourceId,
        sourceInstanceSha256: item.sourceInstanceSha256,
        depthClass: item.depthClass, track: item.track, mechanism: item.mechanism,
        witnessDepth: item.witnessDepth, configCanonicalSha256: config.configCanonicalSha256,
        ...unavailable, ...outcome,
    };
    if (record.stateCapUsage === null && Number.isFinite(record.statesExplored)) {
        record.stateCapUsage = record.statesExplored / 500000;
    }
    if (record.candidateCapUsage === null && Number.isFinite(record.candidatesGenerated)) {
        record.candidateCapUsage = record.candidatesGenerated / 5000000;
    }
    if (record.terminalSearchStage === null) record.terminalSearchStage = record.lastMeaningfulDepth;
    return { ...record, recordCanonicalSha256: canonicalHash(record) };
}

function failureLandscape(aggregate) {
    const clusters = [];
    for (const [dimension, groups] of Object.entries({
        mechanism: aggregate.byMechanism, depthClass: aggregate.byDepthClass,
        sourceCategory: aggregate.bySourceCategory,
    })) {
        for (const [label, data] of Object.entries(groups)) {
            if (data.count >= 3 && data.solved < data.count) {
                clusters.push({ dimension, label, cases: data.count, solved: data.solved,
                    failed: data.count - data.solved, failureRate: 1 - data.solveRate,
                    outcomes: data.byStatus });
            }
        }
    }
    clusters.sort((a, b) => b.failed - a.failed || b.failureRate - a.failureRate || a.label.localeCompare(b.label));
    return {
        schemaVersion: 1, outcome: aggregate.total.byStatus,
        targetSolvedCounts: aggregate.targetSolvedCounts,
        targetsWithAnySolved: aggregate.targetsWithAnySolved,
        byMechanism: aggregate.byMechanism, byDepthClass: aggregate.byDepthClass,
        bySourceCategory: aggregate.bySourceCategory, byTrack: aggregate.byTrack,
        targetComparisons: aggregate.targetResults,
        observedFailureClusters: clusters,
    };
}

function report(config, aggregate, identity, landscape) {
    const lines = [
        '# Hard 53×3 Formal Solver Baseline', '',
        `Baseline ID: \`${identity.baselineId}\``,
        `Baseline canonical SHA-256: \`${identity.baselineCanonicalSha256}\``,
        `Benchmark canonical SHA-256: \`${identity.benchmarkCanonicalSha256}\``,
        `Solver code SHA-256: \`${identity.solverCodeCanonicalSha256}\``,
        `Config SHA-256: \`${identity.configCanonicalSha256}\``, '',
        `Outcomes: ${aggregate.total.solved}/${aggregate.total.count} solved (${(100 * aggregate.total.solveRate).toFixed(2)}%).`,
        `Target families: ${Object.entries(aggregate.targetSolvedCounts).map(([name, count]) => `${name}=${count}`).join(', ')}.`,
        `Termination counts: ${Object.entries(aggregate.total.byStatus).map(([name, count]) => `${name}=${count}`).join(', ')}.`, '',
        '## Cost summary', '',
        '| Cohort | Metric | Min | Median | p90 | p95 | Max |',
        '| --- | --- | ---: | ---: | ---: | ---: | ---: |',
    ];
    for (const [cohort, metrics] of Object.entries(aggregate.costs)) {
        for (const [metric, stats] of Object.entries(metrics)) {
            const format = value => value === null ? 'unavailable' : Number(value.toFixed(2)).toString();
            lines.push(`| ${cohort} | ${metric} (n=${stats.count}) | ${format(stats.min)} | ${format(stats.median)} | ${format(stats.p90)} | ${format(stats.p95)} | ${format(stats.max)} |`);
        }
    }
    lines.push('', '## Observed failure clusters', '');
    for (const cluster of landscape.observedFailureClusters.slice(0, 10)) {
        lines.push(`- ${cluster.dimension}/${cluster.label}: ${cluster.failed}/${cluster.cases} failed; outcomes ${Object.entries(cluster.outcomes).filter(([, n]) => n).map(([s, n]) => `${s}=${n}`).join(', ')}.`);
    }
    lines.push('', 'Machine-readable config, per-instance records, aggregate, landscape, resume state, and identity are authoritative.',
        `Execution: fresh Node subprocess per instance, concurrency ${config.configuration.concurrency}, internal timeout ${config.configuration.internalLimits.maxSearchTimeMs} ms, external watchdog ${config.configuration.externalWatchdogMs} ms.`,
        'Missing production counters are recorded as null with availability notes. No Solver search semantics were changed.', '');
    return lines.join('\n');
}

async function saveResume(outputDir, config, cases, count, last) {
    await atomicJson(path.join(outputDir, 'resume-state.json'), {
        schemaVersion: 1, baselineId: BASELINE_ID,
        configCanonicalSha256: config.configCanonicalSha256,
        completed: count, total: cases.length, pending: cases.length - count,
        lastCompleted: last ?? null,
    });
}

async function run(outputDir, prepareOnly) {
    const { config, cases } = await prepare(outputDir);
    console.log(`Validated frozen release: ${cases.length} members; config ${config.configCanonicalSha256}`);
    if (prepareOnly) return;
    const records = [];
    const expectedFiles = new Set(cases.map(item => path.basename(recordPath(outputDir, item))));
    for (const filename of await readdir(path.join(outputDir, 'records'))) {
        if (filename.endsWith('.json') && !expectedFiles.has(filename)) throw new Error(`Unexpected resume record: ${filename}`);
    }
    for (const item of cases) {
        const filePath = recordPath(outputDir, item);
        let record;
        try {
            record = await readJson(filePath);
            validateRecord(record, item, config);
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
            const outcome = await runFreshCase(item);
            record = completedRecord(item, config, outcome);
            await atomicJson(filePath, record);
        }
        records.push(record);
        await saveResume(outputDir, config, cases, records.length, item.instanceId);
        console.log(`${records.length}/${cases.length} ${item.targetId}:${item.familySlot} ${record.status}`);
    }
    const aggregate = aggregateResults(cases, records);
    const landscape = failureLandscape(aggregate);
    const identity = baselineIdentity(config, records);
    await atomicJson(path.join(outputDir, 'results.json'), {
        schemaVersion: 1, baselineId: BASELINE_ID,
        configCanonicalSha256: config.configCanonicalSha256, records,
        resultCanonicalSha256: identity.resultCanonicalSha256,
    });
    await atomicJson(path.join(outputDir, 'aggregate.json'), aggregate);
    await atomicJson(path.join(outputDir, 'failure-landscape.json'), landscape);
    await atomicJson(path.join(outputDir, 'identity.json'), identity);
    await writeFile(path.join(outputDir, 'REPORT.md'), report(config, aggregate, identity, landscape), 'utf8');
    console.log(`Complete: ${aggregate.total.solved}/${aggregate.total.count} solved; baseline ${identity.baselineCanonicalSha256}`);
}

const parsed = options(process.argv.slice(2));
if (parsed.help) console.log('Usage: node benchmarks/tools/run-hard-53x3-solver-baseline.mjs [--prepare-only] [--output-dir PATH]');
else {
    try { await run(parsed.outputDir, parsed.prepareOnly); }
    catch (error) { console.error(error?.stack ?? String(error)); process.exitCode = 1; }
}
