import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.self = { postMessage() {} };
const { shapeSolverTestOnly } = await import('../shapeSolver.js');

const rotation = {
    targetShapeCodes: ['SuWuCuRu'], startingShapeCodes: ['CuRuSuWu'],
    enabledOperations: ['Rotator CW'], maxLayers: 4, maxStatesPerLevel: 10,
    preventWaste: false, orientationSensitive: true, allowSplitting: false, cleanPainting: false,
};
const invalidPair = {
    targetShapeCodes: ['RuRuRuRu'], startingShapeCodes: ['CuCuCuCu', 'HuHuHuHuHuHu'],
    enabledOperations: ['Swapper'], maxLayers: 4, maxStatesPerLevel: 10,
    preventWaste: false, orientationSensitive: true, allowSplitting: false, cleanPainting: false,
};
const logical = result => ({ outcome: result.outcome, limitReason: result.limitReason,
    depth: result.depth, statesExplored: result.statesExplored,
    generatedStates: result.generatedStates, beamPruned: result.beamPruned,
    solutionPath: result.solutionPath });

test('profile observes a solved search without changing its logical result or counters', async () => {
    const plain = await shapeSolverTestOnly(rotation);
    const rows = [];
    const profile = { sampleEvery: 1, onState: row => rows.push(row) };
    const observed = await shapeSolverTestOnly(rotation, { profile });
    assert.deepEqual(logical(observed), logical(plain));
    assert.equal(profile.data.expandedStates, rows.length);
    assert.equal(profile.data.counters.successors, observed.generatedStates);
    assert.equal(profile.data.counters.rawAttempts, profile.data.counters.successors
        + (profile.data.counters.invalidInputs ?? 0)
        + (profile.data.counters.emptyOutputSkips ?? 0)
        + (profile.data.counters.unaryIdentitySkips ?? 0));
    assert.equal(profile.data.stateSamples.length, rows.length);
    assert.ok(profile.data.shapeSummary.total >= profile.data.shapeSummary.initial);
});

test('pair probe separates theoretical, eligible and invalid attempts', async () => {
    const plain = await shapeSolverTestOnly(invalidPair);
    const profile = { sampleEvery: 1 };
    const observed = await shapeSolverTestOnly(invalidPair, { profile });
    assert.deepEqual(logical(observed), logical(plain));
    assert.equal(profile.data.counters.theoreticalPairs, 3);
    assert.equal(profile.data.counters.resourceSelfPairSkips, 2);
    assert.equal(profile.data.counters.rawAttempts, 1);
    assert.equal(profile.data.counters.invalidInputs, 1);
    assert.equal(profile.data.counters.successors ?? 0, 0);
    assert.equal(profile.data.stateSamples[0].shadow.pairwiseByOperator.Swapper.invalid, 1);
});
