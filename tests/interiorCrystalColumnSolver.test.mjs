import assert from 'node:assert/strict';
import test from 'node:test';

import { interiorCrystalColumnSolve } from '../interiorCrystalColumnSolver.js';
import { replaySolution } from './helpers/shapeSolverOracle.mjs';

const CONFIG = Object.freeze({
    id: 'ICCDCS-A',
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

const LEFT_INTERIOR = 'RrcrRrRr:RgcrRgRg:--cr----';
const LOWER_INTERIOR = 'RrRrcrRr:RgRgcrRg:----cr--';

test('interior Crystal column and ordinary overlay construct and replay', async () => {
    const input = instance(LEFT_INTERIOR, Array(4).fill('RuRuRuRu'));
    const result = await interiorCrystalColumnSolve(input, CONFIG);
    assert.equal(result.architectureStatus, 'solved');
    assert.equal(result.interiorCrystalStage, 'full-height-column-extraction');
    assert.equal(result.sharedPlanKind, 'interior-crystal-column-decomposition');
    assert.equal(replaySolution(input, result.solutionPath, result).valid, true);
});

test('rotated interior Crystal column uses the same target-derived topology', async () => {
    const input = instance(LOWER_INTERIOR, Array(4).fill('RuRuRuRu'));
    const result = await interiorCrystalColumnSolve(input, CONFIG);
    assert.equal(result.architectureStatus, 'solved');
    assert.equal(replaySolution(input, result.solutionPath, result).valid, true);
});

test('interior Crystal solution consumes every token at most once', async () => {
    const input = instance(LEFT_INTERIOR, Array(4).fill('RuRuRuRu'));
    const result = await interiorCrystalColumnSolve(input, CONFIG);
    const consumed = new Set();
    for (const step of result.solutionPath) {
        for (const token of step.inputs) {
            assert.equal(consumed.has(token.id), false, `token ${token.id} was reused`);
            consumed.add(token.id);
        }
    }
});

test('missing Crystal Generator fails cleanly', async () => {
    const input = instance(
        LEFT_INTERIOR,
        Array(4).fill('RuRuRuRu'),
        ALL_OPERATIONS.filter(operation => operation !== 'Crystal Generator'),
    );
    const result = await interiorCrystalColumnSolve(input, CONFIG);
    assert.equal(result.solutionPath, null);
    assert.equal(result.architectureStatus, 'unsupported-domain');
    assert.match(result.constructionError, /Crystal Generator/);
});

test('insufficient sacrificial resources exhaust without token reuse', async () => {
    const input = instance(LEFT_INTERIOR, Array(3).fill('RuRuRuRu'));
    const result = await interiorCrystalColumnSolve(input, CONFIG);
    assert.equal(result.solutionPath, null);
    assert.equal(result.architectureStatus, 'shared-resource-construction-failed');
    assert.match(result.constructionError, /surplus shared atom|cover exact target demands/);
});

test('existing E-013 solution delegates unchanged', async () => {
    const input = instance('Cu------', ['Cu------']);
    const result = await interiorCrystalColumnSolve(input, CONFIG);
    assert.equal(result.architectureStatus, 'solved');
    assert.equal(result.interiorCrystalStage, 'delegated-e013');
});
