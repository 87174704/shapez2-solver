import test from 'node:test';
import assert from 'node:assert/strict';

import {
    isolatedPinGoalDecomposedSolve,
    isolatedPinGoalDecomposedTestOnly,
} from '../isolatedPinGoalDecomposedSolver.js';
import { replaySolution } from './helpers/shapeSolverOracle.mjs';

const CONFIG = Object.freeze({
    id: 'small-domain',
    maxExtractionOperations: 8,
    maxExtractionStates: 180000,
    maxMatchingTransitions: 750000,
    maxOperations: 768,
    maxWallMs: 12000,
});

const OPERATIONS = Object.freeze([
    'Rotator CW', 'Rotator CCW', 'Rotator 180', 'Half Destroyer',
    'Cutter', 'Swapper', 'Stacker', 'Painter', 'Pin Pusher', 'Crystal Generator',
]);

function problem(target, count = 20, overrides = {}) {
    return {
        targetShapeCodes: [target],
        startingShapeCodes: Array(count).fill('CuCuCuCu'),
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
    const result = await isolatedPinGoalDecomposedSolve(instance, CONFIG);
    assert.equal(result.architectureStatus, 'solved', result.constructionError);
    assert.ok(Array.isArray(result.solutionPath));
    assert.equal(result.depth, result.solutionPath.length);
    const replay = replaySolution(instance, result.solutionPath, result);
    assert.equal(replay.valid, true, replay.error ?? 'replay failed');
    assert.equal(replay.error, null);
    return result;
}

test('isolated Pin uses a resource-accounted Crystal scaffold and replays', async () => {
    const result = await solveAndReplay(problem('P-------', 12));
    assert.equal(result.component, 'resource-accounted-isolated-pin-v1');
    assert.equal(result.isolationMode, 'pin');
    assert.equal(result.isolatedDemandCount, 12);
    const operations = result.solutionPath.map(step => step.operation);
    assert.ok(operations.includes('Crystal Generator'));
    assert.ok(operations.includes('Cutter'));
    assert.ok(operations.includes('Pin Pusher'));
});

test('pure Pin stage builds a terminal isolated Pin above an ordinary base', async () => {
    const result = await solveAndReplay(problem('Cu------:P-------', 13));
    assert.equal(result.isolationMode, 'pin');
    assert.equal(result.isolatedDemandCount, 13);
    assert.ok(result.solutionPath.some(step => step.operation === 'Stacker'));
});

test('mixed stage uses the same isolated-Pin primitive for a terminal Pin branch', async () => {
    const target = 'P-----P-:cr------';
    const demandPlan = isolatedPinGoalDecomposedTestOnly.enumerateDemands('mixed', target, 4);
    const result = await solveAndReplay(problem(target, demandPlan.demands.length));
    assert.equal(result.isolationMode, 'mixed');
    assert.equal(result.isolatedDemandCount, demandPlan.demands.length);
    assert.ok(result.solutionPath.some(step => step.operation === 'Swapper'));
});

test('global distinct matching rejects one-too-few sacrificial resources', async () => {
    const result = await isolatedPinGoalDecomposedSolve(problem('P-------', 11), CONFIG);
    assert.equal(result.solutionPath, null);
    assert.equal(result.architectureStatus, 'resource-mismatch');
    assert.equal(result.isolatedDemandCount, 12);
});

test('isolated construction rejects a required disabled operation', async () => {
    const result = await isolatedPinGoalDecomposedSolve(problem('P-------', 12, {
        enabledOperations: OPERATIONS.filter(operation => operation !== 'Crystal Generator'),
    }), CONFIG);
    assert.equal(result.solutionPath, null);
    assert.equal(result.architectureStatus, 'unsupported-domain');
    assert.match(result.constructionError, /Crystal Generator/);
});

test('prior E-010 member delegates without invoking isolated-Pin construction', async () => {
    const instance = problem('P-------:Cu------', 1, { startingShapeCodes: ['CuCuCuCu'] });
    const result = await solveAndReplay(instance);
    assert.equal(result.isolationStage, 'delegated-e010');
    assert.equal(result.component, 'crystal-scaffold-gdcs-v1');
});
