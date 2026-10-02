import test from 'node:test';
import assert from 'node:assert/strict';

import {
    mixedPinCrystalGoalDecomposedSolve,
    mixedPinCrystalGoalDecomposedTestOnly,
} from '../mixedPinCrystalGoalDecomposedSolver.js';
import { planMixedPinCrystalSubassembly } from '../benchmarks/tools/mixed-pin-crystal-construction-planner.mjs';
import { replaySolution } from './helpers/shapeSolverOracle.mjs';

const CONFIG = Object.freeze({
    id: 'small-domain',
    maxExtractionOperations: 8,
    maxExtractionStates: 50000,
    maxMatchingTransitions: 50000,
    maxOperations: 256,
    maxWallMs: 3000,
});

const OPERATIONS = Object.freeze([
    'Rotator CW', 'Rotator CCW', 'Rotator 180', 'Half Destroyer',
    'Cutter', 'Swapper', 'Stacker', 'Painter', 'Pin Pusher', 'Crystal Generator',
]);

function problem(target, startingShapeCodes, overrides = {}) {
    return {
        targetShapeCodes: [target],
        startingShapeCodes,
        enabledOperations: OPERATIONS,
        maxLayers: 4,
        maxStatesPerLevel: 3000,
        preventWaste: false,
        orientationSensitive: false,
        allowSplitting: false,
        cleanPainting: true,
        ...overrides,
    };
}

async function solveAndReplay(instance) {
    const result = await mixedPinCrystalGoalDecomposedSolve(instance, CONFIG);
    assert.equal(result.architectureStatus, 'solved', result.constructionError);
    assert.ok(Array.isArray(result.solutionPath));
    assert.equal(result.depth, result.solutionPath.length);
    const replay = replaySolution(instance, result.solutionPath, result);
    assert.equal(replay.valid, true, replay.error ?? 'replay failed');
    assert.equal(replay.error, null);
    return result;
}

test('mixed stage builds a Crystal suffix before adding its supporting Pin', async () => {
    const result = await solveAndReplay(problem(
        'P-----Cu:cr------',
        Array(4).fill('CuCuCuCu'),
    ));
    assert.equal(result.component, 'mixed-pin-crystal-support-safe-v1');
    assert.equal(result.mixedDemandCount, 4);
    const operations = result.solutionPath.map(step => step.operation);
    assert.ok(operations.indexOf('Crystal Generator') < operations.indexOf('Pin Pusher'));
    assert.ok(operations.includes('Swapper'));
});

test('mixed stage replays a quarter-column recomposition exactly', async () => {
    const result = await solveAndReplay(problem(
        'cwP---P-:--cw--cw',
        Array(9).fill('CuCuCuCu'),
    ));
    assert.equal(result.mixedDemandCount, 9);
    assert.ok(result.solutionPath.filter(step => step.operation === 'Swapper').length >= 2);
    assert.ok(result.solutionPath.some(step => step.operation === 'Rotator CCW'));
});

test('mixed stage enforces globally distinct starting resources', async () => {
    const result = await mixedPinCrystalGoalDecomposedSolve(problem(
        'P-----Cu:cr------',
        Array(3).fill('CuCuCuCu'),
    ), CONFIG);
    assert.equal(result.solutionPath, null);
    assert.equal(result.architectureStatus, 'resource-mismatch');
    assert.equal(result.mixedDemandCount, 4);
});

test('mixed stage rejects a required disabled operation', async () => {
    const result = await mixedPinCrystalGoalDecomposedSolve(problem(
        'P-----Cu:cr------',
        Array(4).fill('CuCuCuCu'),
        { enabledOperations: OPERATIONS.filter(operation => operation !== 'Crystal Generator') },
    ), CONFIG);
    assert.equal(result.solutionPath, null);
    assert.equal(result.architectureStatus, 'unsupported-domain');
    assert.match(result.constructionError, /Crystal Generator/);
});

test('frozen stage detects and excludes terminal isolated-Pin layouts', async () => {
    const target = 'WwcbWwcb:P-cwP-cw:WgP---P-';
    const plan = planMixedPinCrystalSubassembly(target, 4);
    assert.equal(mixedPinCrystalGoalDecomposedTestOnly.requiresTerminalIsolatedPin(plan), true);
    const result = await mixedPinCrystalGoalDecomposedSolve(problem(target, []), CONFIG);
    assert.equal(result.solutionPath, null);
    assert.equal(result.architectureStatus, 'unsupported-terminal-isolated-pin');
});

test('non-mixed targets delegate through the unchanged E-009 frontier component', async () => {
    const result = await solveAndReplay(problem('P-------:Cu------', ['CuCuCuCu']));
    assert.equal(result.component, 'crystal-scaffold-gdcs-v1');
});
