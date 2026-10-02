#!/usr/bin/env node

// Reproducible, opt-in performance baseline for the shape solver. This is a
// benchmark rather than a node:test file so `npm test` never runs it.
import assert from 'node:assert/strict';
import os from 'node:os';
import process from 'node:process';

// shapeSolver.js is also a Web Worker entry point. The solver only needs this
// no-op postMessage implementation while it is benchmarked under Node.
globalThis.self = { postMessage() {} };

const { shapeSolver } = await import('../../shapeSolver.js');

const OMNI_START = ['CuCuCuCu', 'RuRuRuRu', 'SuSuSuSu', 'WuWuWuWu'];
const OMNI_TARGET = ['CuRuSuWu'];
const ALL_OPERATIONS = [
    'Rotator CW', 'Rotator CCW', 'Rotator 180', 'Half Destroyer', 'Cutter',
    'Swapper', 'Stacker', 'Painter', 'Pin Pusher', 'Crystal Generator',
];

function makeConfig({ operations = ALL_OPERATIONS, maxStatesPerLevel, allowSplitting = false }) {
    return {
        targetShapeCodes: OMNI_TARGET,
        startingShapeCodes: OMNI_START,
        enabledOperations: operations,
        maxLayers: 4,
        maxStatesPerLevel,
        preventWaste: false,
        orientationSensitive: false,
        allowSplitting,
        cleanPainting: false,
    };
}

function solutionSignature(solutionPath) {
    if (!solutionPath) return null;
    return solutionPath.map((step) => {
        const inputs = step.inputs.map(({ shape }) => shape).join(',');
        const outputs = step.outputs.map(({ shape }) => shape).join(',');
        const color = step.params?.color ? `@${step.params.color}` : '';
        return `${step.operation}:${inputs}=>${outputs}${color}`;
    }).join('|');
}

function resultKind(result) {
    if (result?.outcome === 'limit' || result?.limitReached) {
        return `limit:${result?.limitReason ?? 'unknown'}`;
    }
    if (result?.outcome) return result.outcome;
    return result?.solutionPath ? 'solved' : 'no-solution';
}

const WORKLOADS = Object.freeze([
    {
        id: 'W1',
        name: 'omni-all-ops-cap-1000',
        description: 'Quick default: all operations, ordinary bounded search.',
        config: makeConfig({ maxStatesPerLevel: 1000 }),
        expected: {
            kind: 'solved', beamPruned: true, depth: 6, statesExplored: 3612, generatedStates: 106816,
            signature: 'Swapper:CuCuCuCu,RuRuRuRu=>CuCuRuRu,RuRuCuCu|Rotator CW:CuCuRuRu=>RuCuCuRu|Swapper:SuSuSuSu,RuCuCuRu=>SuSuCuRu,RuCuSuSu|Swapper:WuWuWuWu,SuSuCuRu=>WuWuCuRu,SuSuWuWu|Rotator CCW:SuSuWuWu=>SuWuWuSu|Swapper:WuWuCuRu,SuWuWuSu=>SuWuCuRu,WuWuWuSu',
        },
    },
    {
        id: 'W2',
        name: 'omni-all-ops-cap-5000',
        description: 'High-frontier quality and transient-memory workload.',
        config: makeConfig({ maxStatesPerLevel: 5000 }),
        expected: {
            kind: 'solved', beamPruned: true, depth: 5, statesExplored: 10612, generatedStates: 238356,
            signature: 'Swapper:CuCuCuCu,RuRuRuRu=>CuCuRuRu,RuRuCuCu|Swapper:SuSuSuSu,WuWuWuWu=>SuSuWuWu,WuWuSuSu|Rotator CW:CuCuRuRu=>RuCuCuRu|Rotator CW:WuWuSuSu=>SuWuWuSu|Swapper:RuCuCuRu,SuWuWuSu=>RuCuWuSu,SuWuCuRu',
        },
    },
    {
        id: 'W3',
        name: 'omni-all-ops-splitting-cap-1000',
        description: 'Successful splitting-mode search.',
        config: makeConfig({ maxStatesPerLevel: 1000, allowSplitting: true }),
        expected: {
            kind: 'solved', beamPruned: true, depth: 7, statesExplored: 4790, generatedStates: 164009,
            signature: 'Swapper:CuCuCuCu,RuRuRuRu=>CuCuRuRu,RuRuCuCu|Rotator CW:CuCuRuRu=>RuCuCuRu|Swapper:SuSuSuSu,RuCuCuRu=>SuSuCuRu,RuCuSuSu|Rotator CW:RuCuSuSu=>SuRuCuSu|Swapper:WuWuWuWu,SuRuCuSu=>WuWuCuSu,SuRuWuWu|Rotator CW:WuWuCuSu=>SuWuWuCu|Swapper:SuSuCuRu,SuWuWuCu=>SuSuWuCu,SuWuCuRu',
        },
    },
    {
        id: 'W4',
        name: 'omni-restricted-operations',
        description: 'No-result search with only shape-combining operations and beam pruning.',
        config: makeConfig({
            operations: ['Half Destroyer', 'Cutter', 'Swapper', 'Stacker'],
            maxStatesPerLevel: 1000,
        }),
        expected: {
            kind: 'not-found-pruned', beamPruned: true, depth: 21, statesExplored: 17155, generatedStates: 139718,
            signature: null,
        },
    },
    {
        id: 'W5',
        name: 'omni-splitting-budget-stress',
        description: 'Historical splitting stress workload; current experiment requires a budgeted solution.',
        stress: true,
        config: makeConfig({ maxStatesPerLevel: 100, allowSplitting: true }),
        expected: {
            kind: 'solved', beamPruned: true, depth: 9, statesExplored: 735, generatedStates: 21777,
            signature: 'Swapper:CuCuCuCu,RuRuRuRu=>CuCuRuRu,RuRuCuCu|Rotator CW:CuCuRuRu=>RuCuCuRu|Swapper:SuSuSuSu,RuCuCuRu=>SuSuCuRu,RuCuSuSu|Swapper:WuWuWuWu,SuSuCuRu=>WuWuCuRu,SuSuWuWu|Stacker:RuRuCuCu,SuSuWuWu=>RuRuCuCu:SuSuWuWu|Rotator CW:RuCuSuSu=>SuRuCuSu|Swapper:WuWuCuRu,SuRuCuSu=>WuWuCuSu,SuRuCuRu|Rotator CW:WuWuCuSu=>SuWuWuCu|Swapper:SuRuCuRu,SuWuWuCu=>SuWuCuRu,SuRuWuCu',
        },
    },
]);

function usage() {
    return `Usage: node --expose-gc tests/perf/shapeSolver.bench.mjs [options]

  --quick              Run W1 only (default).
  --full               Run W1 through W4.
  --stress             Explicitly include W5; alone it runs W5 only.
  --warmup <n>         Warmup iterations per workload (default: 2).
  --runs <n>           Timed iterations per workload (default: 5).
  --json               Write the complete report as JSON.
  --help               Show this help.

Examples:
  npm run bench
  npm run bench:full
  npm run bench:stress
  node --expose-gc tests/perf/shapeSolver.bench.mjs --quick --warmup 0 --runs 1 --json`;
}

function parseNonNegativeInteger(value, flag) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isSafeInteger(parsed) || parsed < 0 || String(parsed) !== value) {
        throw new Error(`${flag} requires a non-negative integer; received ${value ?? '(missing)'}.`);
    }
    return parsed;
}

function parseOptions(args) {
    let mode = 'quick';
    let includeStress = false;
    let warmup = 2;
    let runs = 5;
    let json = false;

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === '--quick') mode = 'quick';
        else if (arg === '--full') mode = 'full';
        else if (arg === '--stress') includeStress = true;
        else if (arg === '--json') json = true;
        else if (arg === '--help') return { help: true };
        else if (arg === '--warmup' || arg === '--runs') {
            const value = args[index + 1];
            if (arg === '--warmup') warmup = parseNonNegativeInteger(value, arg);
            else runs = parseNonNegativeInteger(value, arg);
            index += 1;
        } else {
            throw new Error(`Unknown option: ${arg}`);
        }
    }

    if (runs === 0) throw new Error('--runs must be at least 1.');
    return { mode, includeStress, warmup, runs, json };
}

function selectedWorkloads(options) {
    const standard = options.mode === 'full'
        ? WORKLOADS.filter((workload) => !workload.stress)
        : [WORKLOADS[0]];
    if (!options.includeStress) return standard;
    return options.mode === 'full' ? [...standard, WORKLOADS.at(-1)] : [WORKLOADS.at(-1)];
}

function forceGc() {
    if (typeof global.gc === 'function') global.gc();
}

function memorySnapshot() {
    const memory = process.memoryUsage();
    return {
        rssMiB: memory.rss / 1024 / 1024,
        heapUsedMiB: memory.heapUsed / 1024 / 1024,
        heapTotalMiB: memory.heapTotal / 1024 / 1024,
        maxRssMiB: process.resourceUsage().maxRSS / 1024,
    };
}

function assertExpected(workload, result) {
    const expected = workload.expected;
    const actual = {
        kind: resultKind(result),
        beamPruned: result?.beamPruned,
        depth: result?.depth,
        statesExplored: result?.statesExplored,
        generatedStates: result?.generatedStates,
        signature: solutionSignature(result?.solutionPath),
    };
    assert.deepEqual(actual, expected, `${workload.id} is no longer deterministic.`);
    return actual;
}

async function runOnce(workload) {
    forceGc();
    const before = memorySnapshot();
    const cpuStart = process.cpuUsage();
    const wallStart = performance.now();
    const config = workload.config;
    let result = await shapeSolver(
        config.targetShapeCodes,
        config.startingShapeCodes,
        config.enabledOperations,
        config.maxLayers,
        config.maxStatesPerLevel,
        config.preventWaste,
        config.orientationSensitive,
        config.allowSplitting,
        config.cleanPainting,
    );
    const wallMs = performance.now() - wallStart;
    const cpu = process.cpuUsage(cpuStart);
    const actual = assertExpected(workload, result);
    const after = memorySnapshot();
    // Do not keep a completed result live merely because this benchmark frame
    // is still active when the post-run heap snapshot is taken.
    result = null;
    forceGc();
    const afterGc = memorySnapshot();

    return {
        wallMs,
        cpuMs: (cpu.user + cpu.system) / 1000,
        cpuUserMs: cpu.user / 1000,
        cpuSystemMs: cpu.system / 1000,
        result: actual,
        memoryApproxMiB: {
            rssBefore: before.rssMiB,
            rssAfter: after.rssMiB,
            maxRss: after.maxRssMiB,
            maxRssDeltaFromStart: after.maxRssMiB - before.rssMiB,
            heapBefore: before.heapUsedMiB,
            heapAfter: after.heapUsedMiB,
            heapAfterGc: afterGc.heapUsedMiB,
        },
    };
}

function summarize(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((total, value) => total + value, 0) / values.length;
    const middle = Math.floor(sorted.length / 2);
    return {
        min: sorted[0],
        median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
        mean,
        max: sorted.at(-1),
        stdev: Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length),
    };
}

function rounded(value) {
    return Math.round(value * 100) / 100;
}

function summarizeMeasurements(measurements) {
    const memory = measurements.map((measurement) => measurement.memoryApproxMiB);
    return {
        wallMs: summarize(measurements.map((measurement) => measurement.wallMs)),
        cpuMs: summarize(measurements.map((measurement) => measurement.cpuMs)),
        memoryApproxMiB: {
            maxRss: summarize(memory.map((value) => value.maxRss)),
            maxRssDeltaFromStart: summarize(memory.map((value) => value.maxRssDeltaFromStart)),
            heapAfterGc: summarize(memory.map((value) => value.heapAfterGc)),
        },
    };
}

function reportFor(workload, measurements) {
    const { config, expected, ...metadata } = workload;
    return {
        ...metadata,
        config,
        expected,
        stableResult: measurements[0].result,
        summary: summarizeMeasurements(measurements),
        measurements,
    };
}

function printHuman(report) {
    const { options, environment, workloads } = report;
    console.log(`Shape solver benchmark — Node ${environment.node}, ${environment.platform}/${environment.arch}`);
    console.log(`warmup=${options.warmup}, runs=${options.runs}, GC exposed=${environment.gcExposed}`);
    for (const workload of workloads) {
        const wall = workload.summary.wallMs;
        const cpu = workload.summary.cpuMs;
        const memory = workload.summary.memoryApproxMiB;
        console.log(`\n${workload.id} ${workload.name}`);
        console.log(`  result=${workload.stableResult.kind}, depth=${workload.stableResult.depth}, states=${workload.stableResult.statesExplored}, generated=${workload.stableResult.generatedStates}`);
        console.log(`  wall ms median=${rounded(wall.median)} mean=${rounded(wall.mean)} min=${rounded(wall.min)} max=${rounded(wall.max)} stdev=${rounded(wall.stdev)}`);
        console.log(`  CPU ms median=${rounded(cpu.median)} mean=${rounded(cpu.mean)}; approximate max RSS MiB median=${rounded(memory.maxRss.median)} (+${rounded(memory.maxRssDeltaFromStart.median)} from run start), heap after GC median=${rounded(memory.heapAfterGc.median)}`);
    }
    console.log('\nMemory values are process high-water/heap snapshots, not a continuous allocation trace. No wall-clock pass/fail threshold is applied.');
}

async function main() {
    let options;
    try {
        options = parseOptions(process.argv.slice(2));
    } catch (error) {
        console.error(error.message);
        console.error(usage());
        process.exitCode = 2;
        return;
    }
    if (options.help) {
        console.log(usage());
        return;
    }

    const workloads = [];
    for (const workload of selectedWorkloads(options)) {
        for (let index = 0; index < options.warmup; index += 1) {
            await runOnce(workload);
        }
        const measurements = [];
        for (let index = 0; index < options.runs; index += 1) {
            measurements.push(await runOnce(workload));
        }
        workloads.push(reportFor(workload, measurements));
    }

    const report = {
        benchmark: 'shape-solver',
        generatedAt: new Date().toISOString(),
        options,
        environment: {
            node: process.version,
            platform: process.platform,
            release: os.release(),
            arch: process.arch,
            cpuModel: os.cpus()[0]?.model ?? 'unknown',
            logicalCpuCount: os.cpus().length,
            totalMemoryGiB: os.totalmem() / 1024 / 1024 / 1024,
            gcExposed: typeof global.gc === 'function',
        },
        workloads,
    };

    if (options.json) console.log(JSON.stringify(report, null, 2));
    else printHuman(report);
}

await main();
