#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { sharedOccurrenceGoalDecomposedSolve } from '../../sharedOccurrenceGoalDecomposedSolver.js';
import { replaySolution } from '../../tests/helpers/shapeSolverOracle.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BASELINE_ROOT = path.join(ROOT, 'benchmarks/solver-baselines/hard-53x3-v1');
const CONFIG_PATH = path.join(
    ROOT, 'benchmarks/experiments/shared-occurrence-goal-decomposed-v1/configs.json',
);

async function readJson(file) {
    return JSON.parse(await readFile(file, 'utf8'));
}

const configs = await readJson(CONFIG_PATH);
const configuration = configs.configurations[0];
const requested = new Set(process.argv.slice(2));
const names = (await readdir(path.join(BASELINE_ROOT, 'records'))).filter(name => name.endsWith('.json')).sort();
const sourceCache = new Map();
for (const name of names) {
    const record = await readJson(path.join(BASELINE_ROOT, 'records', name));
    const key = `${record.targetId}:${record.familySlot}`;
    if (requested.size && !requested.has(key) && !requested.has(record.targetId)) continue;
    let source = sourceCache.get(record.sourceArtifact);
    if (!source) {
        source = await readJson(path.join(ROOT, record.sourceArtifact));
        sourceCache.set(record.sourceArtifact, source);
    }
    const instances = Array.isArray(source) ? source : source.instances;
    const instance = instances.find(row => row.id === record.instanceId);
    const input = {
        targetShapeCodes: [instance.target],
        startingShapeCodes: instance.availableInputs.flatMap(row => Array(row.count).fill(row.shape)),
        enabledOperations: [
            'Rotator CW', 'Rotator CCW', 'Rotator 180', 'Half Destroyer', 'Cutter',
            'Swapper', 'Stacker', 'Painter', 'Pin Pusher', 'Crystal Generator',
        ],
        maxLayers: 4,
        maxStatesPerLevel: 3000,
        preventWaste: false,
        orientationSensitive: false,
        allowSplitting: false,
        cleanPainting: true,
    };
    const result = await sharedOccurrenceGoalDecomposedSolve(input, configuration);
    const replay = Array.isArray(result.solutionPath)
        ? replaySolution(input, result.solutionPath, result) : null;
    process.stdout.write(`${key} ${result.architectureStatus} replay=${replay?.valid ?? '-'} depth=${result.depth}`
        + `${result.constructionError ? ` error=${result.constructionError}` : ''}\n`);
}
