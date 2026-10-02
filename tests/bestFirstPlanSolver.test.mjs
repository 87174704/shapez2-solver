import test from 'node:test';
import assert from 'node:assert/strict';

import { bestFirstPlanSolve } from '../bestFirstPlanSolver.js';
import { ShapeOperationConfig, rotate90CW } from '../shapeOperations.js';
import { referenceSolve, replaySolution } from './helpers/shapeSolverOracle.mjs';

const C = 'CuCuCuCu';
const R = 'RuRuRuRu';
const S = 'CuRuSuWu';

const CONFIG = Object.freeze({
    id: 'small-domain',
    maxOperations: 10,
    maxChartNodes: 5000,
    maxExpandedNodes: 2000,
    maxCandidateAttempts: 30000,
    maxVariantsPerShape: 16,
    maxPartnerPool: 64,
    maxPartnersPerExpansion: 32,
    maxWallMs: 2000,
});

function problem(overrides = {}) {
    return {
        targetShapeCodes: [C],
        startingShapeCodes: [C],
        enabledOperations: [],
        maxLayers: 4,
        maxStatesPerLevel: 3000,
        preventWaste: false,
        orientationSensitive: true,
        allowSplitting: false,
        cleanPainting: true,
        maxDepth: 10,
        ...overrides,
    };
}

async function solveAndReplay(instance) {
    const result = await bestFirstPlanSolve(instance, CONFIG);
    assert.equal(result.outcome, 'solved', JSON.stringify(result));
    const replay = replaySolution(instance, result.solutionPath, result);
    assert.equal(replay.valid, true, replay.error);
    return result;
}

test('best-first plan synthesis covers a two-step preparatory rotation chain', async () => {
    const cfg = new ShapeOperationConfig(4);
    const once = rotate90CW((await import('../shapeOperations.js')).Shape.fromShapeCode(S), cfg)[0];
    const target = rotate90CW(once, cfg)[0].toShapeCode();
    const result = await solveAndReplay(problem({
        targetShapeCodes: [target],
        startingShapeCodes: [S],
        enabledOperations: ['Rotator CW'],
    }));
    assert.deepEqual(result.solutionPath.map(step => step.operation), ['Rotator CW', 'Rotator CW']);
});

test('best-first plan synthesis preserves Cutter siblings in public replay', async () => {
    const result = await solveAndReplay(problem({
        targetShapeCodes: ['----SuWu'],
        startingShapeCodes: [S],
        enabledOperations: ['Cutter'],
    }));
    assert.equal(result.solutionPath[0].outputs.length, 2);
});

test('best-first plan synthesis covers ordered Stacker with disjoint resources', async () => {
    const instance = problem({
        targetShapeCodes: [`${C}:${R}`],
        startingShapeCodes: [C, R],
        enabledOperations: ['Stacker'],
    });
    assert.equal(referenceSolve(instance).kind, 'found');
    const result = await solveAndReplay(instance);
    assert.deepEqual(result.solutionPath.map(step => step.operation), ['Stacker']);
});

test('resource masks prevent consuming one input twice', async () => {
    const instance = problem({
        targetShapeCodes: [`${C}:${C}`],
        startingShapeCodes: [C],
        enabledOperations: ['Stacker'],
    });
    assert.notEqual(referenceSolve(instance).kind, 'found');
    const result = await bestFirstPlanSolve(instance, CONFIG);
    assert.notEqual(result.outcome, 'solved');
});

test('best-first plan synthesis supports Pin Pusher targets', async () => {
    const result = await solveAndReplay(problem({
        targetShapeCodes: ['P-P-P-P-:CuCuCuCu'],
        startingShapeCodes: [C],
        enabledOperations: ['Pin Pusher'],
    }));
    assert.deepEqual(result.solutionPath.map(step => step.operation), ['Pin Pusher']);
});

test('best-first plan synthesis supports target-colored Crystal Generator', async () => {
    const result = await solveAndReplay(problem({
        targetShapeCodes: ['cgcgCuCu'],
        startingShapeCodes: ['----CuCu'],
        enabledOperations: ['Crystal Generator'],
    }));
    assert.deepEqual(result.solutionPath.map(step => step.operation), ['Crystal Generator']);
    assert.equal(result.solutionPath[0].params.color, 'g');
});

test('unsupported splitting is classified without reading benchmark metadata', async () => {
    const result = await bestFirstPlanSolve(problem({ allowSplitting: true }), CONFIG);
    assert.equal(result.architectureStatus, 'unsupported-domain');
    assert.equal(result.solutionPath, null);
});
