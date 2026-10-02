import assert from 'node:assert/strict';
import test from 'node:test';

import { unsupportedCrystalResourcePoolSolve } from '../unsupportedCrystalResourcePoolSolver.js';
import { replaySolution } from './helpers/shapeSolverOracle.mjs';

const CONFIG = Object.freeze({
    id: 'UCRPGDCS-A',
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

test('broader staged Crystal layout enters the physical-mask pool and replays', async () => {
    const input = instance('crCucrCu:crCucrCu:cbcbcbcb', Array(6).fill('CuCuCuCu'));
    const result = await unsupportedCrystalResourcePoolSolve(input, CONFIG);
    assert.equal(result.architectureStatus, 'solved');
    assert.equal(result.unsupportedCrystalStage, 'physical-mask-resource-pool');
    assert.equal(result.sharedPlanKind, 'staged-full-layer-refinement-mask');
    assert.equal(replaySolution(input, result.solutionPath, result).valid, true);
});

test('broader Crystal solution consumes every token at most once', async () => {
    const input = instance('crCucrCu:crCucrCu:cbcbcbcb', Array(6).fill('CuCuCuCu'));
    const result = await unsupportedCrystalResourcePoolSolve(input, CONFIG);
    const consumed = new Set();
    for (const step of result.solutionPath) {
        for (const token of step.inputs) {
            assert.equal(consumed.has(token.id), false, `token ${token.id} was reused`);
            consumed.add(token.id);
        }
    }
});

test('existing E-012 solution delegates without entering the new stage', async () => {
    const input = instance('Cu------', ['Cu------']);
    const result = await unsupportedCrystalResourcePoolSolve(input, CONFIG);
    assert.equal(result.architectureStatus, 'solved');
    assert.equal(result.unsupportedCrystalStage, 'delegated-e012');
});

test('disabled Cutter fails the broader-Crystal stage cleanly', async () => {
    const input = instance(
        'crCucrCu:crCucrCu:cbcbcbcb',
        Array(6).fill('CuCuCuCu'),
        ALL_OPERATIONS.filter(operation => operation !== 'Cutter'),
    );
    const result = await unsupportedCrystalResourcePoolSolve(input, CONFIG);
    assert.equal(result.solutionPath, null);
    assert.equal(result.architectureStatus, 'unsupported-domain');
    assert.equal(result.unsupportedCrystalStage, 'physical-mask-resource-pool');
    assert.match(result.constructionError, /Cutter/);
});

test('unsupported Crystal geometry remains a clean exhausted result', async () => {
    const input = instance('XucrXuXu:XucrXuXu:--cr----', Array(4).fill('XuXuXuXu'));
    const result = await unsupportedCrystalResourcePoolSolve(input, CONFIG);
    assert.equal(result.solutionPath, null);
    assert.equal(result.architectureStatus, 'shared-resource-construction-failed');
    assert.equal(result.unsupportedCrystalStage, 'physical-mask-resource-pool');
    assert.match(result.constructionError, /Crystal construction unsupported/);
});
