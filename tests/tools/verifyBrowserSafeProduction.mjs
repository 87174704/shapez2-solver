#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

globalThis.self = { postMessage() {} };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BASELINE_ROOT = path.join(ROOT, 'benchmarks/solver-baselines/hard-53x3-v1');
const FRONTIER_PATH = path.join(
    ROOT,
    'benchmarks/experiments/interior-crystal-column-v1/ICCDCS-A/repeat.json',
);
const ALL_OPERATIONS = Object.freeze([
    'Rotator CW', 'Rotator CCW', 'Rotator 180', 'Half Destroyer', 'Cutter',
    'Swapper', 'Stacker', 'Painter', 'Pin Pusher', 'Crystal Generator',
]);

const [{ shapeSolver }, { replaySolution }] = await Promise.all([
    import('../../shapeSolver.js'),
    import('../helpers/shapeSolverOracle.mjs'),
]);

const frontier = JSON.parse(await readFile(FRONTIER_PATH, 'utf8'));
const expectedPaths = new Map(frontier.records.map(record => [
    `${record.targetId}:${record.familySlot}`,
    record.result.solutionPath,
]));
const recordNames = (await readdir(path.join(BASELINE_ROOT, 'records')))
    .filter(name => name.endsWith('.json')).sort();
const sourceCache = new Map();
const summary = {
    members: recordNames.length,
    solved: 0,
    replayValid: 0,
    exactE014Paths: 0,
    constructiveRoutes: 0,
    resourceReuse: 0,
    distinctTargets: 0,
};
const targets = new Set();

for (const name of recordNames) {
    const record = JSON.parse(await readFile(path.join(BASELINE_ROOT, 'records', name), 'utf8'));
    let source = sourceCache.get(record.sourceArtifact);
    if (!source) {
        source = JSON.parse(await readFile(path.join(ROOT, record.sourceArtifact), 'utf8'));
        sourceCache.set(record.sourceArtifact, source);
    }
    const instances = Array.isArray(source) ? source : source.instances;
    const instance = instances.find(row => row.id === record.instanceId);
    if (!instance || instance.instanceSha256 !== record.sourceInstanceSha256) {
        throw new Error(`Formal member binding failed: ${name}`);
    }
    const input = {
        targetShapeCodes: [instance.target],
        startingShapeCodes: instance.availableInputs.flatMap(row => Array(row.count).fill(row.shape)),
        enabledOperations: ALL_OPERATIONS,
        maxLayers: 4,
        maxStatesPerLevel: 3000,
        preventWaste: false,
        orientationSensitive: false,
        allowSplitting: false,
        cleanPainting: true,
    };
    const result = await shapeSolver(
        input.targetShapeCodes,
        input.startingShapeCodes,
        input.enabledOperations,
        input.maxLayers,
        input.maxStatesPerLevel,
        input.preventWaste,
        input.orientationSensitive,
        input.allowSplitting,
        input.cleanPainting,
    );
    if (Array.isArray(result.solutionPath)) summary.solved += 1;
    if (result.solverRoute === 'constructive-hybrid') summary.constructiveRoutes += 1;
    const replay = replaySolution(input, result.solutionPath, result);
    if (!replay.valid) throw new Error(`${name}: invalid replay: ${replay.error}`);
    summary.replayValid += 1;
    const key = `${record.targetId}:${record.familySlot}`;
    if (JSON.stringify(expectedPaths.get(key)) !== JSON.stringify(result.solutionPath)) {
        throw new Error(`${name}: path differs from frozen E-014 repeat`);
    }
    summary.exactE014Paths += 1;
    const consumed = new Set();
    for (const step of result.solutionPath) {
        for (const token of step.inputs) {
            if (consumed.has(token.id)) summary.resourceReuse += 1;
            consumed.add(token.id);
        }
    }
    targets.add(record.targetId);
}

summary.distinctTargets = targets.size;
const passed = summary.members === 159
    && summary.solved === 159
    && summary.replayValid === 159
    && summary.exactE014Paths === 159
    && summary.constructiveRoutes === 159
    && summary.resourceReuse === 0
    && summary.distinctTargets === 53;
if (!passed) throw new Error(`Browser-safe production verification failed: ${JSON.stringify(summary)}`);
process.stdout.write(`PASS: ${JSON.stringify(summary)}\n`);
