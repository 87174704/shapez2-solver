import assert from 'node:assert/strict';
import test from 'node:test';

import {
    sharedOccurrenceGoalDecomposedSolve,
    sharedOccurrenceGoalDecomposedTestOnly,
} from '../sharedOccurrenceGoalDecomposedSolver.js';
import { replaySolution } from './helpers/shapeSolverOracle.mjs';

const CONFIG = Object.freeze({
    id: 'SOGDCS-A',
    maxExtractionOperations: 8,
    maxExtractionStates: 180000,
    maxMatchingTransitions: 750000,
    maxOperations: 768,
    maxWallMs: 12000,
});
const ALL_OPERATIONS = Object.freeze([
    'Rotator CW', 'Rotator CCW', 'Rotator 180', 'Half Destroyer', 'Cutter',
    'Swapper', 'Stacker', 'Painter', 'Pin Pusher', 'Crystal Generator',
]);

function instance(target, inputs, enabledOperations = ALL_OPERATIONS) {
    return {
        targetShapeCodes: [target],
        startingShapeCodes: inputs,
        enabledOperations,
        maxLayers: 4,
        maxStatesPerLevel: 3000,
        preventWaste: false,
        orientationSensitive: false,
        allowSplitting: false,
        cleanPainting: true,
    };
}

test('shared occurrence retains both Cutter outputs and solves a one-token four-cell target', async () => {
    const input = instance('CuRuSuWu', ['CuRuSuWu']);
    const result = await sharedOccurrenceGoalDecomposedSolve(input, CONFIG);
    assert.equal(result.architectureStatus, 'solved');
    assert.equal(result.sharedOccurrenceStage, 'resource-mismatch-fallback');
    assert.ok(result.solutionPath.some(step => step.operation === 'Cutter' && step.outputs.length === 2));
    const replay = replaySolution(input, result.solutionPath, result);
    assert.equal(replay.valid, true, replay.error);
});

test('shared occurrence never reuses a consumed token', async () => {
    const input = instance('CuRuSuWu', ['CuRuSuWu']);
    const result = await sharedOccurrenceGoalDecomposedSolve(input, CONFIG);
    const consumed = new Set();
    for (const step of result.solutionPath) {
        for (const token of step.inputs) {
            assert.equal(consumed.has(token.id), false, `token ${token.id} was reused`);
            consumed.add(token.id);
        }
    }
});

test('insufficient multiplicity remains an exhausted resource failure', async () => {
    const input = instance('CuCu----', ['Cu------']);
    const result = await sharedOccurrenceGoalDecomposedSolve(input, CONFIG);
    assert.equal(result.solutionPath, null);
    assert.equal(result.architectureStatus, 'shared-resource-construction-failed');
});

test('disabled Cutter prevents shared partitioning cleanly', () => {
    const input = instance('CuRu----', ['CuRu----'], ALL_OPERATIONS.filter(op => op !== 'Cutter'));
    const result = sharedOccurrenceGoalDecomposedTestOnly.sharedResourceConstruct(input, CONFIG);
    assert.equal(result.solutionPath, null);
    assert.equal(result.architectureStatus, 'unsupported-domain');
    assert.match(result.constructionError, /Cutter/);
});

test('already solved E-011 members delegate without entering the shared stage', async () => {
    const input = instance('Cu------', ['Cu------']);
    const result = await sharedOccurrenceGoalDecomposedSolve(input, CONFIG);
    assert.equal(result.architectureStatus, 'solved');
    assert.equal(result.sharedOccurrenceStage, 'delegated-e011');
});

test('unsupported broader-Crystal layouts do not enter the resource fallback', async () => {
    const input = instance('cr------:--cb----', ['CuCuCuCu']);
    const result = await sharedOccurrenceGoalDecomposedSolve(input, CONFIG);
    assert.equal(result.architectureStatus, 'unsupported-crystal-layout');
    assert.equal(result.sharedOccurrenceStage, 'delegated-e011');
});
