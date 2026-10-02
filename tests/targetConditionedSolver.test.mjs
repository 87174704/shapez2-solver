import test from 'node:test';
import assert from 'node:assert/strict';

import { targetConditionedSolve, targetConditionedTestOnly } from '../targetConditionedSolver.js';
import { Shape, ShapeOperationConfig } from '../shapeOperations.js';
import { referenceSolve, replaySolution } from './helpers/shapeSolverOracle.mjs';

const C = 'CuCuCuCu';
const R = 'RuRuRuRu';
const S = 'CuRuSuWu';
const W = 'WuCuRuSu';

const CONFIG = Object.freeze({
    id: 'small-domain',
    admissionMode: 'strict-subgoal',
    maxOperations: 8,
    maxChartNodes: 2000,
    maxCandidateAttempts: 10000,
    maxVariantsPerShape: 16,
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
        maxDepth: 8,
        ...overrides,
    };
}

async function expectSolved(instance, expectedOperations) {
    const reference = referenceSolve(instance, { maxStates: 20000, maxTransitions: 200000 });
    assert.equal(reference.kind, 'found');
    const result = await targetConditionedSolve(instance, CONFIG);
    assert.equal(result.outcome, 'solved');
    assert.deepEqual(result.solutionPath.map(step => step.operation), expectedOperations);
    const replay = replaySolution(instance, result.solutionPath, result);
    assert.equal(replay.valid, true, replay.error);
}

test('target analysis recognizes attainable uncolored fragments but not conflicting parts', () => {
    const targetShape = Shape.fromShapeCode('CrCrCrCr');
    const analysis = targetConditionedTestOnly.createTargetAnalysis(
        [targetShape],
        new ShapeOperationConfig(4),
        true,
    );
    assert.equal(analysis.analyze(C).compatible, true);
    assert.equal(analysis.analyze(R).compatible, false);
});

test('small-domain oracle gate covers target-conditioned rotation', async () => {
    await expectSolved(problem({
        targetShapeCodes: [W],
        startingShapeCodes: [S],
        enabledOperations: ['Rotator CW'],
    }), ['Rotator CW']);
});

test('small-domain oracle gate covers Cutter sibling selection and replay order', async () => {
    const instance = problem({
        targetShapeCodes: ['----SuWu'],
        startingShapeCodes: [S],
        enabledOperations: ['Cutter'],
    });
    const result = await targetConditionedSolve(instance, CONFIG);
    assert.equal(result.outcome, 'solved');
    assert.equal(result.solutionPath[0].outputs.length, 2);
    assert.equal(replaySolution(instance, result.solutionPath, result).valid, true);
});

test('small-domain oracle gate covers clean Painter', async () => {
    const instance = problem({
        targetShapeCodes: ['CrCrCrCr'],
        startingShapeCodes: [C],
        enabledOperations: ['Painter'],
    });
    const result = await targetConditionedSolve(instance, CONFIG);
    assert.equal(result.outcome, 'solved');
    assert.deepEqual(result.solutionPath.map(step => step.operation), ['Painter']);
    assert.equal(replaySolution(instance, result.solutionPath, result).valid, true);
});

test('small-domain oracle gate covers ordered Stacker with disjoint resources', async () => {
    await expectSolved(problem({
        targetShapeCodes: [`${C}:${R}`],
        startingShapeCodes: [C, R],
        enabledOperations: ['Stacker'],
    }), ['Stacker']);
});

test('resource masks prevent one input from being consumed twice', async () => {
    const instance = problem({
        targetShapeCodes: [`${C}:${C}`],
        startingShapeCodes: [C],
        enabledOperations: ['Stacker'],
    });
    const reference = referenceSolve(instance);
    assert.notEqual(reference.kind, 'found');
    const result = await targetConditionedSolve(instance, CONFIG);
    assert.notEqual(result.outcome, 'solved');
    assert.equal(result.solutionPath, null);
});

test('ordinary first stage rejects special-part targets without reading benchmark metadata', async () => {
    const result = await targetConditionedSolve(problem({
        targetShapeCodes: ['P-P-P-P-:CuCuCuCu'],
        startingShapeCodes: [C],
        enabledOperations: ['Pin Pusher'],
    }), CONFIG);
    assert.equal(result.architectureStatus, 'unsupported-domain');
    assert.equal(result.solutionPath, null);
});
