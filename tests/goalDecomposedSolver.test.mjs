import test from 'node:test';
import assert from 'node:assert/strict';

import { goalDecomposedSolve } from '../goalDecomposedSolver.js';
import { replaySolution } from './helpers/shapeSolverOracle.mjs';

const CONFIG = Object.freeze({
    id: 'small-domain',
    maxExtractionOperations: 8,
    maxExtractionStates: 256,
    maxMatchingTransitions: 20000,
    maxOperations: 128,
    maxWallMs: 2000,
});

const ALL_ORDINARY = Object.freeze([
    'Rotator CW', 'Rotator CCW', 'Rotator 180', 'Half Destroyer',
    'Cutter', 'Swapper', 'Stacker', 'Painter',
]);

function problem(overrides = {}) {
    return {
        targetShapeCodes: ['CrCrCrCr'],
        startingShapeCodes: ['CuCuCuCu', 'CuCuCuCu', 'CuCuCuCu', 'CuCuCuCu'],
        enabledOperations: ALL_ORDINARY,
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
    const result = await goalDecomposedSolve(instance, CONFIG);
    assert.equal(result.outcome, 'solved', JSON.stringify(result));
    const replay = replaySolution(instance, result.solutionPath, result);
    assert.equal(replay.valid, true, replay.error);
    return result;
}

test('extracts Cutter output, rotates it, paints it, and replays the exact public path', async () => {
    const result = await solveAndReplay(problem({
        targetShapeCodes: ['------Cr'],
        startingShapeCodes: ['CuRuSuWu'],
    }));
    assert.ok(result.solutionPath.some(step => step.operation === 'Cutter'));
    assert.ok(result.solutionPath.some(step => step.operation === 'Painter'));
    assert.ok(result.solutionPath.filter(step => step.operation === 'Cutter')
        .some(step => step.outputs.length === 2));
});

test('constructs an exact multi-cell layer from distinct one-use resources', async () => {
    const result = await solveAndReplay(problem({
        targetShapeCodes: ['CrRrSgWb'],
        startingShapeCodes: ['CuCuCuCu', 'RuRuRuRu', 'SuSuSuSu', 'WuWuWuWu'],
    }));
    assert.ok(result.solutionPath.filter(step => step.operation === 'Stacker').length >= 3);
});

test('constructs and replays an exact multi-layer target', async () => {
    await solveAndReplay(problem({
        targetShapeCodes: ['Cr------:Rb------'],
        startingShapeCodes: ['CuCuCuCu', 'RuRuRuRu'],
    }));
});

test('global resource matching repairs a greedy allocation trap', async () => {
    await solveAndReplay(problem({
        targetShapeCodes: ['CrRr----'],
        startingShapeCodes: ['CuRu----', 'CuCu----'],
    }));
});

test('resource shortage is an exhausted mismatch and never reuses a starting token', async () => {
    const result = await goalDecomposedSolve(problem({
        targetShapeCodes: ['CrCr----'],
        startingShapeCodes: ['CuCuCuCu'],
    }), CONFIG);
    assert.equal(result.outcome, 'exhausted');
    assert.equal(result.architectureStatus, 'resource-mismatch');
    assert.equal(result.solutionPath, null);
});

test('unpaintable refined cells require an exact source color', async () => {
    const result = await goalDecomposedSolve(problem({
        targetShapeCodes: ['Xk------'],
        startingShapeCodes: ['XwXwXwXw'],
    }), CONFIG);
    assert.equal(result.outcome, 'exhausted');
    assert.equal(result.solutionPath, null);
});

test('disabled extraction operation is not silently used', async () => {
    const result = await goalDecomposedSolve(problem({
        targetShapeCodes: ['Cr------'],
        startingShapeCodes: ['CuCuCuCu'],
        enabledOperations: ['Rotator CW', 'Painter', 'Stacker'],
    }), CONFIG);
    assert.equal(result.outcome, 'exhausted');
    assert.equal(result.solutionPath, null);
});

test('special-part targets remain explicitly unsupported in GDCS-A', async () => {
    const result = await goalDecomposedSolve(problem({
        targetShapeCodes: ['P-------:Cu------'],
        startingShapeCodes: ['CuCuCuCu'],
    }), CONFIG);
    assert.equal(result.architectureStatus, 'unsupported-domain');
    assert.equal(result.solutionPath, null);
});
