import test from 'node:test';
import assert from 'node:assert/strict';

import { crystalScaffoldGoalDecomposedSolve } from '../crystalScaffoldGoalDecomposedSolver.js';
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
    const result = await crystalScaffoldGoalDecomposedSolve(instance, CONFIG);
    assert.equal(result.architectureStatus, 'solved');
    assert.ok(Array.isArray(result.solutionPath));
    assert.equal(result.depth, result.solutionPath.length);
    const replay = replaySolution(instance, result.solutionPath, result);
    assert.equal(replay.valid, true, replay.error ?? 'replay failed');
    assert.equal(replay.error, null);
    return result;
}

test('Crystal scaffold reversal builds a dense Crystal layer under physical solids', async () => {
    const result = await solveAndReplay(problem(
        'crcrcrcr:CuCuCuCu',
        ['CuCuCuCu', 'CuCuCuCu', 'CuCuCuCu', 'CuCuCuCu'],
    ));
    assert.equal(result.crystalScaffoldCode, 'P-P-P-P-:CuCuCuCu');
    assert.equal(result.solutionPath.at(-1).operation, 'Crystal Generator');
    assert.deepEqual(result.solutionPath.at(-1).params, { color: 'r' });
});

test('Crystal scaffold reversal supports a dense multi-layer mixed solid scaffold', async () => {
    const result = await solveAndReplay(problem(
        'CucrCucr:CuCuCuCu',
        [
            'CuCuCuCu', 'CuCuCuCu', 'CuCuCuCu',
            'CuCuCuCu', 'CuCuCuCu', 'CuCuCuCu',
        ],
    ));
    assert.equal(result.crystalCount, 2);
    assert.equal(result.component, 'crystal-scaffold-v1');
});

test('Crystal scaffold stage rejects a disabled Crystal Generator', async () => {
    const result = await crystalScaffoldGoalDecomposedSolve(problem(
        'crcrcrcr:CuCuCuCu',
        ['CuCuCuCu', 'CuCuCuCu', 'CuCuCuCu', 'CuCuCuCu'],
        { enabledOperations: OPERATIONS.filter(operation => operation !== 'Crystal Generator') },
    ), CONFIG);
    assert.equal(result.solutionPath, null);
    assert.equal(result.crystalLayoutReason, 'crystal-generator-disabled');
});

test('Crystal scaffold stage truthfully rejects sparse Crystal layouts', async () => {
    const result = await crystalScaffoldGoalDecomposedSolve(
        problem('cr------:Cu------', ['CuCuCuCu']), CONFIG,
    );
    assert.equal(result.solutionPath, null);
    assert.equal(result.crystalLayoutReason, 'sparse-crystal-layout');
});

test('Crystal scaffold stage truthfully rejects mixed Crystal colors', async () => {
    const result = await crystalScaffoldGoalDecomposedSolve(problem(
        'crcbcrcb:CuCuCuCu',
        ['CuCuCuCu', 'CuCuCuCu', 'CuCuCuCu', 'CuCuCuCu'],
    ), CONFIG);
    assert.equal(result.solutionPath, null);
    assert.equal(result.crystalLayoutReason, 'mixed-crystal-colors');
});

test('Crystal scaffold stage truthfully rejects final Pin layouts', async () => {
    const result = await crystalScaffoldGoalDecomposedSolve(problem(
        'P-crcrcr:CuCuCuCu',
        ['CuCuCuCu', 'CuCuCuCu', 'CuCuCuCu', 'CuCuCuCu'],
    ), CONFIG);
    assert.equal(result.solutionPath, null);
    assert.equal(result.crystalLayoutReason, 'final-pin-crystal-layout');
});

test('non-Crystal targets delegate unchanged to the Pin-aware component', async () => {
    const result = await solveAndReplay(problem('P-------:Cu------', ['CuCuCuCu']));
    assert.equal(result.component, 'pin-gdcs-v1');
});
