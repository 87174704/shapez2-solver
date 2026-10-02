#!/usr/bin/env node

// Opt-in, manifest-driven benchmark. Each case is deliberately isolated in a
// fresh Node process so maxRSS is a per-case high-water approximation.
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { access, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const MANIFEST_PATH = path.join(ROOT, 'benchmarks', 'manifest.json');
const ALL_OPERATIONS = Object.freeze([
    'Rotator CW', 'Rotator CCW', 'Rotator 180', 'Half Destroyer', 'Cutter',
    'Swapper', 'Stacker', 'Painter', 'Pin Pusher', 'Crystal Generator',
]);
const REQUIRED_CASE_FIELDS = Object.freeze(['id', 'suite', 'source', 'line', 'target', 'partition', 'sha256']);
const SUITES = new Set(['hard', 'insane']);
const PARTITIONS = new Set(['development', 'validation', 'holdout', 'stress']);
const MANIFEST_SOURCES = new Set(['hard_main.txt', 'hard_side.txt', 'insane_main.txt', 'insane_side.txt']);
const IDENTITY_FILES = Object.freeze({
    shapeSolver: 'shapeSolver.js',
    shapeSolverWeb: 'shapeSolver_web.js',
    shapeOperations: 'shapeOperations.js',
    oracleHelper: 'tests/helpers/shapeSolverOracle.mjs',
    harness: 'tests/perf/officialWorkload.bench.mjs',
});

function usage() {
    return `Usage: npm run bench:official -- [options]

  --suite <hard|insane>                 Default: hard
  --source <source>                     Select one manifest source
  --partition <development|validation|holdout|stress|all>
                                       Default: development
  --case <id>                           Select one manifest case
  --timeout-ms <positive integer>       Parent-process watchdog (default: 30000)
  --include-holdout                     Required before a holdout case can run
  --json | --output json                Emit the complete JSON report
  --output-file <path>                  Save the complete JSON report
  --help                                Show this help

The manifest is benchmarks/manifest.json. No result is treated as an
observation, never as a wall-clock pass/fail result.`;
}

function positiveInteger(value, flag) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isSafeInteger(parsed) || parsed < 1 || String(parsed) !== value) {
        throw new Error(`${flag} requires a positive integer; received ${value ?? '(missing)'}.`);
    }
    return parsed;
}

function parseOptions(args) {
    const options = {
        suite: 'hard', source: null, partition: 'development', partitionExplicit: false, caseId: null,
        timeoutMs: 30_000, includeHoldout: false, json: false, outputFile: null,
    };
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === '--help') return { help: true };
        if (arg === '--include-holdout') options.includeHoldout = true;
        else if (arg === '--json') options.json = true;
        else if (arg === '--suite' || arg === '--source' || arg === '--partition' || arg === '--case' || arg === '--timeout-ms' || arg === '--output' || arg === '--output-file') {
            const value = args[++index];
            if (value === undefined) throw new Error(`${arg} requires a value.`);
            if (arg === '--suite') options.suite = value;
            else if (arg === '--source') options.source = value;
            else if (arg === '--partition') {
                options.partition = value;
                options.partitionExplicit = true;
            }
            else if (arg === '--case') options.caseId = value;
            else if (arg === '--timeout-ms') options.timeoutMs = positiveInteger(value, arg);
            else if (arg === '--output-file') options.outputFile = value;
            else if (value.toLowerCase() === 'json') options.json = true;
            else throw new Error('--output only supports json.');
        } else {
            throw new Error(`Unknown option: ${arg}`);
        }
    }
    if (!SUITES.has(options.suite)) throw new Error(`--suite must be hard or insane; received ${options.suite}.`);
    if (options.partition !== 'all' && !PARTITIONS.has(options.partition)) {
        throw new Error(`Unknown partition: ${options.partition}.`);
    }
    if (options.partition === 'holdout' && !options.includeHoldout) {
        throw new Error('--partition holdout requires --include-holdout.');
    }
    return options;
}

function sha256(value) {
    return createHash('sha256').update(value).digest('hex');
}

async function loadSourceIdentity() {
    const entries = await Promise.all(Object.entries(IDENTITY_FILES).map(async ([name, relativePath]) => {
        const bytes = await readFile(path.join(ROOT, relativePath));
        return [name, { path: relativePath, sha256: sha256(bytes), bytes: bytes.byteLength, raw: bytes }];
    }));
    const sourceIdentity = Object.fromEntries(entries);
    const byteIdentical = sourceIdentity.shapeSolver.raw.equals(sourceIdentity.shapeSolverWeb.raw);
    if (!byteIdentical) throw new Error('shapeSolver.js and shapeSolver_web.js are not byte-identical.');
    for (const source of MANIFEST_SOURCES) {
        const bytes = await readFile(path.join(ROOT, 'benchmarks', source));
        sourceIdentity[source] = { path: `benchmarks/${source}`, sha256: sha256(bytes), bytes: bytes.byteLength };
    }
    for (const source of Object.values(sourceIdentity)) delete source.raw;
    return { ...sourceIdentity, byteIdentical };
}

function manifestCases(manifest) {
    if (Array.isArray(manifest)) return manifest;
    if (manifest && Array.isArray(manifest.cases)) return manifest.cases;
    throw new Error('Manifest must be an array or an object with a cases array.');
}

function validateCase(entry, index) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error(`Manifest case ${index} must be an object.`);
    for (const field of REQUIRED_CASE_FIELDS) {
        if (!(field in entry)) throw new Error(`Manifest case ${index} is missing required field '${field}'.`);
    }
    if (!entry.id || typeof entry.id !== 'string') throw new Error(`Manifest case ${index} has an invalid id.`);
    if (!SUITES.has(entry.suite)) throw new Error(`Manifest case ${entry.id} has an invalid suite.`);
    if (!PARTITIONS.has(entry.partition)) throw new Error(`Manifest case ${entry.id} has an invalid partition.`);
    if (typeof entry.source !== 'string' || !MANIFEST_SOURCES.has(entry.source)) throw new Error(`Manifest case ${entry.id} has an invalid source.`);
    if (!Number.isInteger(entry.line) || entry.line < 1) throw new Error(`Manifest case ${entry.id} has an invalid line.`);
    if (typeof entry.target !== 'string' || !entry.target) throw new Error(`Manifest case ${entry.id} has an invalid target.`);
    if (typeof entry.sha256 !== 'string' || !/^[a-fA-F0-9]{64}$/.test(entry.sha256)) throw new Error(`Manifest case ${entry.id} has an invalid sha256.`);
    if (entry.sha256.toLowerCase() !== sha256(entry.target)) throw new Error(`Manifest case ${entry.id} sha256 does not match its target.`);
}

async function loadManifest() {
    let raw;
    try {
        raw = await readFile(MANIFEST_PATH, 'utf8');
    } catch (error) {
        if (error.code === 'ENOENT') throw new Error(`Official manifest is missing: ${MANIFEST_PATH}`);
        throw error;
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        throw new Error(`Official manifest is not valid JSON: ${error.message}`);
    }
    const cases = manifestCases(parsed);
    cases.forEach(validateCase);
    const ids = new Set();
    const sourceLines = new Set();
    for (const entry of cases) {
        if (ids.has(entry.id)) throw new Error(`Manifest contains duplicate id: ${entry.id}.`);
        ids.add(entry.id);
        const sourceLine = `${entry.source}\u0000${entry.line}`;
        if (sourceLines.has(sourceLine)) throw new Error(`Manifest contains duplicate source/line: ${entry.source}:${entry.line}.`);
        sourceLines.add(sourceLine);
    }
    const sourceTargets = new Map();
    for (const source of new Set(cases.map(entry => entry.source))) {
        const sourcePath = path.resolve(ROOT, 'benchmarks', source);
        if (path.dirname(sourcePath) !== path.join(ROOT, 'benchmarks')) throw new Error(`Manifest source escapes benchmarks: ${source}.`);
        let sourceRaw;
        try {
            sourceRaw = await readFile(sourcePath, 'utf8');
        } catch (error) {
            if (error.code === 'ENOENT') throw new Error(`Manifest source is missing: ${source}.`);
            throw error;
        }
        sourceTargets.set(source, sourceRaw.split(/\r?\n/).map(line => line.trim()).filter(Boolean));
    }
    for (const entry of cases) {
        if (sourceTargets.get(entry.source)[entry.line - 1] !== entry.target) {
            throw new Error(`Manifest target does not match ${entry.source}:${entry.line}.`);
        }
    }
    return {
        cases,
        identity: {
            path: path.relative(ROOT, MANIFEST_PATH).replaceAll('\\', '/'),
            sha256: sha256(raw),
            caseCount: cases.length,
            schemaVersion: parsed?.schemaVersion ?? null,
        },
    };
}

function selectCases(cases, options) {
    let selected = cases.filter(entry => entry.suite === options.suite);
    if (options.source) selected = selected.filter(entry => entry.source === options.source);
    if (options.caseId) selected = selected.filter(entry => entry.id === options.caseId);
    if ((!options.caseId || options.partitionExplicit) && options.partition !== 'all') {
        selected = selected.filter(entry => entry.partition === options.partition);
    }
    if (!options.includeHoldout) selected = selected.filter(entry => entry.partition !== 'holdout');
    if (options.caseId && selected.length === 0) {
        throw new Error(`No permitted manifest case matched --case ${options.caseId}.`);
    }
    return selected;
}

function caseIdentity(entry) {
    return Object.fromEntries(REQUIRED_CASE_FIELDS.map(field => [field, entry[field]]));
}

function childPayload(entry) {
    return JSON.stringify({ entry });
}

function runFreshCase(entry, timeoutMs) {
    return new Promise(resolve => {
        const child = spawn(process.execPath, ['--expose-gc', fileURLToPath(import.meta.url), '--child'], {
            cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe', 'ipc'], windowsHide: true,
        });
        let stdout = '';
        let stderr = '';
        let timedOut = false;
        let latestProgress = null;
        const withProgress = outcome => ({ ...outcome, latestProgress: latestProgress ?? {
            reachedDepth: null, statesExplored: null, candidates: null, maxRssMiB: null, beamPruned: null,
        } });
        const watchdog = setTimeout(() => {
            timedOut = true;
            child.kill();
        }, timeoutMs);
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', chunk => { stdout += chunk; });
        child.stderr.on('data', chunk => { stderr += chunk; });
        child.on('message', message => {
            if (message?.type === 'progress') latestProgress = message.progress;
        });
        child.on('error', error => {
            clearTimeout(watchdog);
            resolve(withProgress({ status: 'error', error: error.message, stderr }));
        });
        child.on('close', (code, signal) => {
            clearTimeout(watchdog);
            if (timedOut) {
                resolve(withProgress({ status: 'watchdog', watchdogMs: timeoutMs, exitCode: code, signal, stderr }));
                return;
            }
            if (code !== 0) {
                resolve(withProgress({ status: 'error', exitCode: code, signal, error: stderr || `child exited with ${code}`, stderr }));
                return;
            }
            try {
                resolve(withProgress(JSON.parse(stdout)));
            } catch (error) {
                resolve(withProgress({ status: 'error', error: `child returned invalid JSON: ${error.message}`, stdout, stderr }));
            }
        });
        child.stdin.end(childPayload(entry));
    });
}

function numeric(value) {
    return Number.isFinite(value) ? value : null;
}

function summarize(records) {
    const statuses = {
        solved: 0, unsolved: 0, exhausted: 0, notFoundPruned: 0,
        limit: 0, watchdog: 0, cancelled: 0, error: 0,
    };
    const limitsByReason = {};
    const replay = { valid: 0, invalid: 0, unsupported: 0, notRun: 0 };
    let states = 0;
    let candidates = 0;
    for (const record of records) {
        if (record.status === 'exhausted') {
            statuses.unsolved += 1;
            statuses.exhausted += 1;
        } else if (record.status === 'not-found-pruned') {
            statuses.unsolved += 1;
            statuses.notFoundPruned += 1;
        } else if (record.status === 'no-result') {
            // Compatibility for reports emitted before classification v2.
            statuses.unsolved += 1;
        } else statuses[record.status] += 1;
        if (record.status === 'limit') limitsByReason[record.limitReason ?? 'unknown'] = (limitsByReason[record.limitReason ?? 'unknown'] ?? 0) + 1;
        if (record.replay?.status === 'valid') replay.valid += 1;
        else if (record.replay?.status === 'invalid') replay.invalid += 1;
        else if (record.replay?.status === 'unsupported') replay.unsupported += 1;
        else replay.notRun += 1;
        states += record.statesExplored ?? 0;
        candidates += record.candidates ?? 0;
    }
    return {
        cases: records.length,
        ...statuses,
        limitsByReason,
        replay,
        statesExplored: states,
        candidates,
        candidatesPerState: states ? candidates / states : null,
    };
}

function growthByDepth(records) {
    const groups = new Map();
    for (const record of records) {
        if (!Number.isInteger(record.depth)) continue;
        const current = groups.get(record.depth) ?? { depth: record.depth, cases: 0, statesExplored: 0, candidates: 0 };
        current.cases += 1;
        current.statesExplored += record.statesExplored ?? 0;
        current.candidates += record.candidates ?? 0;
        groups.set(record.depth, current);
    }
    let prior = null;
    return [...groups.values()].sort((a, b) => a.depth - b.depth).map(current => {
        const result = {
            ...current,
            candidatesPerState: current.statesExplored ? current.candidates / current.statesExplored : null,
            statesRatioToPriorDepth: prior?.statesExplored ? current.statesExplored / prior.statesExplored : null,
            candidatesRatioToPriorDepth: prior?.candidates ? current.candidates / prior.candidates : null,
        };
        prior = current;
        return result;
    });
}

function printHuman(report) {
    console.log(`Official shape-solver workload — ${report.cases.length} case(s), Node ${report.environment.node}`);
    console.log(`manifest ${report.manifest.path} sha256=${report.manifest.sha256}`);
    for (const record of report.cases) {
        const metrics = `depth=${record.depth ?? '-'} states=${record.statesExplored ?? '-'} candidates=${record.candidates ?? '-'} wallMs=${record.wallMs ?? '-'}`;
        console.log(`${record.id}: ${record.status}; ${metrics}; replay=${record.replay?.status ?? 'not-run'}`);
    }
    const aggregate = report.aggregate;
    console.log(`Aggregate: solved=${aggregate.solved} unsolved=${aggregate.unsolved} exhausted=${aggregate.exhausted} not-found-pruned=${aggregate.notFoundPruned} limit=${aggregate.limit} watchdog=${aggregate.watchdog} cancelled=${aggregate.cancelled} error=${aggregate.error}`);
}

function solutionSignature(solutionPath) {
    if (!Array.isArray(solutionPath)) return null;
    return solutionPath.map(step => {
        const inputs = step.inputs.map(input => input.shape).join(',');
        const outputs = step.outputs.map(output => output.shape).join(',');
        return `${step.operation}:${inputs}=>${outputs}${step.params?.color ? `@${step.params.color}` : ''}`;
    }).join('|');
}

async function runChild() {
    let raw = '';
    for await (const chunk of process.stdin) raw += chunk;
    try {
        const { entry } = JSON.parse(raw);
        globalThis.self = {
            postMessage(message) {
                if (message?.type !== 'status' || !message.messageParams || typeof process.send !== 'function') return;
                const params = message.messageParams;
                process.send({
                    type: 'progress',
                    progress: {
                        reachedDepth: numeric(params.depth),
                        statesExplored: numeric(params.totalStates),
                        candidates: numeric(params.generatedStates),
                        maxRssMiB: process.resourceUsage().maxRSS / 1024,
                        beamPruned: params.beamPruned === true,
                    },
                });
            },
        };
        const [{ Shape, _extractLayers }, { shapeSolver }, { replaySolution }] = await Promise.all([
            import('../../shapeOperations.js'), import('../../shapeSolver.js'), import('../helpers/shapeSolverOracle.mjs'),
        ]);
        const maxLayers = entry.suite === 'insane' ? 5 : 4;
        const targetShapeCodes = [entry.target];
        const startingShapeCodes = _extractLayers(Shape.fromShapeCode(entry.target), 'color', false, false, false);
        const config = {
            targetShapeCodes, startingShapeCodes, enabledOperations: ALL_OPERATIONS, maxLayers,
            maxStatesPerLevel: 3000, preventWaste: false, orientationSensitive: true,
            allowSplitting: true, cleanPainting: false,
        };
        if (typeof global.gc === 'function') global.gc();
        const started = performance.now();
        const result = await shapeSolver(
            config.targetShapeCodes, config.startingShapeCodes, config.enabledOperations, config.maxLayers,
            config.maxStatesPerLevel, config.preventWaste, config.orientationSensitive,
            config.allowSplitting, config.cleanPainting,
        );
        const wallMs = performance.now() - started;
        let replay = { status: 'not-run', diagnostics: null };
        if (Array.isArray(result?.solutionPath)) {
            const checked = replaySolution(config, result.solutionPath, result);
            replay = {
                status: checked.valid ? 'valid' : checked.error?.includes('not replayable') ? 'unsupported' : 'invalid',
                diagnostics: checked.diagnostics ?? null,
                error: checked.error ?? null,
            };
        }
        const status = result?.outcome
            ?? (result?.limitReached ? 'limit' : Array.isArray(result?.solutionPath) ? 'solved' : 'no-result');
        process.stdout.write(JSON.stringify({
            status, limitReason: result?.limitReached ? result.limitReason ?? 'unknown' : null,
            beamPruned: typeof result?.beamPruned === 'boolean' ? result.beamPruned : null,
            depth: numeric(result?.depth), statesExplored: numeric(result?.statesExplored),
            candidates: numeric(result?.generatedStates), wallMs,
            freshProcessMaxRssMiB: process.resourceUsage().maxRSS / 1024,
            pathSignature: solutionSignature(result?.solutionPath),
            replay,
        }));
    } catch (error) {
        process.stdout.write(JSON.stringify({ status: 'error', error: error?.stack ?? String(error) }));
    }
}

async function main() {
    const options = parseOptions(process.argv.slice(2));
    if (options.help) {
        console.log(usage());
        return;
    }
    const sourceIdentity = await loadSourceIdentity();
    const { cases, identity } = await loadManifest();
    const selected = selectCases(cases, options);
    const records = [];
    for (const entry of selected) {
        const outcome = await runFreshCase(entry, options.timeoutMs);
        records.push({ ...caseIdentity(entry), ...outcome });
    }
    const fixedConfiguration = {
        targetShapeCodes: 'singleton manifest target',
        startingShapeCodes: "_extractLayers(Shape.fromShapeCode(target), 'color', false, false, false)",
        enabledOperations: ALL_OPERATIONS, hardMaxLayers: 4, insaneMaxLayers: 5,
        maxStatesPerLevel: 3000, preventWaste: false, orientationSensitive: true,
        allowSplitting: true, cleanPainting: false,
    };
    const report = {
        benchmark: 'shape-solver-official-workload', classificationVersion: 2, generatedAt: new Date().toISOString(), options,
        environment: {
            node: process.version, platform: process.platform, release: os.release(), arch: process.arch,
            cpuModel: os.cpus()[0]?.model ?? 'unknown', logicalCpuCount: os.cpus().length,
            totalMemoryGiB: os.totalmem() / 1024 / 1024 / 1024,
        },
        manifest: identity, sourceIdentity, configuration: fixedConfiguration, cases: records,
        aggregate: summarize(records), growthByDepth: growthByDepth(records),
    };
    const serializedReport = JSON.stringify(report, null, 2);
    if (options.outputFile) {
        const outputPath = path.resolve(process.cwd(), options.outputFile);
        const outputParent = path.dirname(outputPath);
        try {
            await access(outputParent);
        } catch {
            throw new Error(`Output directory does not exist: ${outputParent}`);
        }
        await writeFile(outputPath, `${serializedReport}\n`, 'utf8');
    }
    if (options.json) console.log(serializedReport);
    else printHuman(report);
    if (report.aggregate.replay.invalid > 0) process.exitCode = 1;
}

if (process.argv[2] === '--child') await runChild();
else {
    try {
        await main();
    } catch (error) {
        console.error(error.message);
        process.exitCode = 2;
    }
}
