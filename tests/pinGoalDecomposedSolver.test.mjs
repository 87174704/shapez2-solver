import test from 'node:test';
import assert from 'node:assert/strict';

import { pinGoalDecomposedSolve } from '../pinGoalDecomposedSolver.js';
import { replaySolution } from './helpers/shapeSolverOracle.mjs';

const CONFIG = Object.freeze({
    id: 'small-domain',
    maxExtractionOperations: 8,
    maxExtractionStates: 10000,
    maxMatchingTransitions: 10000,
    maxOperations: 128,
    maxWallMs: 2000,
});

const OPERATIONS = Object.freeze([
    'Rotator CW', 'Rotator CCW', 'Rotator 180', 'Half Destroyer',
    'Cutter', 'Stacker', 'Painter', 'Pin Pusher', 'Crystal Generator',
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
    const result = await pinGoalDecomposedSolve(instance, CONFIG);
    assert.equal(result.architectureStatus, 'solved');
    assert.ok(Array.isArray(result.solutionPath));
    assert.equal(result.depth, result.solutionPath.length);
    const replay = replaySolution(instance, result.solutionPath, result);
    assert.equal(replay.valid, true, replay.error ?? 'replay failed');
    assert.equal(replay.error, null);
    return result;
}

test('Pin-aware construction builds a Pin below a physically extracted solid', async () => {
    const result = await solveAndReplay(problem('P-------:Cu------', ['CuCuCuCu']));
    assert.equal(result.pinLayout, 'pin-column-sequence');
    assert.equal(result.solutionPath.at(-1).operation, 'Pin Pusher');
});

test('Pin-aware construction uses canonical overflow for terminal Pins in a full column', async () => {
    const result = await solveAndReplay(problem(
        'Cu------:P-------:P-------:P-------',
        ['CuCuCuCu', 'RuRuRuRu'],
    ));
    assert.equal(result.solutionPath.filter(step => step.operation === 'Pin Pusher').length, 3);
    assert.equal(result.solutionPath.at(-1).operation, 'Stacker');
});

test('Pin-aware construction composes disjoint Pin columns without reusing resources', async () => {
    const result = await solveAndReplay(problem(
        'P-P-----:CuCu----',
        ['CuCuCuCu', 'CuCuCuCu'],
    ));
    const startingIds = result.solutionPath.flatMap(step => step.inputs.map(input => input.id))
        .filter(id => id < 2);
    assert.deepEqual([...new Set(startingIds)].sort((a, b) => a - b), [0, 1]);
});

test('Pin-aware matching rejects a distinct-resource shortage', async () => {
    const instance = problem('P-P-----:CuCu----', ['CuCuCuCu']);
    const result = await pinGoalDecomposedSolve(instance, CONFIG);
    assert.equal(result.solutionPath, null);
    assert.equal(result.architectureStatus, 'resource-mismatch');
});

test('Pin-aware construction rejects a disabled Pin Pusher', async () => {
    const instance = problem('P-------:Cu------', ['CuCuCuCu'], {
        enabledOperations: OPERATIONS.filter(operation => operation !== 'Pin Pusher'),
    });
    const result = await pinGoalDecomposedSolve(instance, CONFIG);
    assert.equal(result.solutionPath, null);
    assert.equal(result.architectureStatus, 'unsupported-domain');
});

test('Pin-aware first stage leaves Crystal-bearing targets outside its domain', async () => {
    const result = await pinGoalDecomposedSolve(
        problem('cr------', ['CuCuCuCu']),
        CONFIG,
    );
    assert.equal(result.solutionPath, null);
    assert.equal(result.architectureStatus, 'unsupported-domain');
});
