import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.self = { postMessage() {} };

const { shapeSolver, shapeSolverTestOnly } = await import('../shapeSolver.js');
const {
    Q, stateFromTokens, allocateGoal, enumerateActions, referenceSolve, replaySolution, compareWithOracle,
} = await import('./helpers/shapeSolverOracle.mjs');

const C = 'CuCuCuCu';
const R = 'RuRuRuRu';
const S = 'CuRuSuWu';
const W = 'WuCuRuSu';

function problem(overrides = {}) {
    return {
        targetShapeCodes: [C],
        startingShapeCodes: [C],
        enabledOperations: [],
        maxLayers: 2,
        maxDepth: 5,
        preventWaste: false,
        orientationSensitive: true,
        allowSplitting: false,
        ...overrides,
    };
}

async function production(instance, maxStatesPerLevel = 5_000) {
    return shapeSolver(
        instance.targetShapeCodes, instance.startingShapeCodes, instance.enabledOperations, instance.maxLayers,
        maxStatesPerLevel, instance.preventWaste, instance.orientationSensitive, instance.allowSplitting, false,
    );
}

async function productionTestOnly(instance, useCoarseness) {
    return shapeSolverTestOnly({ ...instance, maxStatesPerLevel: 2 }, { useCoarseness, diagnostics: true });
}

test('integer throughput aggregates split capacity and stops at one unit', () => {
    const split = stateFromTokens([{ shape: C, units: Q / 2, count: 2 }]);
    assert.equal(allocateGoal(split, problem()).satisfied, true);
    assert.equal(allocateGoal(stateFromTokens([{ shape: C, units: Q / 2 }]), problem()).satisfied, false);
    assert.equal(enumerateActions(stateFromTokens([{ shape: C, units: 1 }]), problem({ allowSplitting: true })).filter(action => action.operation === 'Splitter').length, 0);
});

test('reference BFS keeps the unsplit shortest path while the split aggregate witness remains replayable', () => {
    const instance = problem({
        targetShapeCodes: [W], startingShapeCodes: [S], enabledOperations: ['Rotator CW'], allowSplitting: true, maxDepth: 4,
    });
    const result = referenceSolve(instance);
    assert.equal(result.kind, 'found');
    assert.equal(result.depth, 1);
    assert.deepEqual(result.path.map(step => step.operation), ['Rotator CW']);
});

test('binary transitions discard unequal throughput and retain the smaller output units', () => {
    const state = stateFromTokens([{ shape: C, units: Q / 2 }, { shape: R, units: Q }]);
    const action = enumerateActions(state, problem({ enabledOperations: ['Swapper'] }))
        .find(candidate => candidate.operation === 'Swapper');
    assert.ok(action);
    assert.deepEqual(action.outputs.map(token => token.units), [Q / 2, Q / 2]);
    assert.equal([...action.next.values()].reduce((sum, count) => sum + count, 0), 2);
});

test('preventWaste permits only legal consume-only destruction and distinguishes surplus', () => {
    const consumes = problem({
        targetShapeCodes: [R], startingShapeCodes: [R, '----CuCu'], enabledOperations: ['Half Destroyer'], preventWaste: true,
    });
    const consume = enumerateActions(stateFromTokens(consumes.startingShapeCodes.map(shape => ({ shape }))), consumes)
        .find(action => action.operation === 'Half Destroyer' && action.outputs.length === 0);
    assert.ok(consume);
    assert.equal(allocateGoal(stateFromTokens([{ shape: C, count: 2 }]), problem({ preventWaste: true })).satisfied, true);
    assert.equal(allocateGoal(stateFromTokens([{ shape: C }, { shape: R }]), problem({ preventWaste: true })).satisfied, false);
    assert.equal(allocateGoal(stateFromTokens([{ shape: C, units: Q / 2, count: 2 }]), problem({ preventWaste: true })).satisfied, true);
});

test('orientation and multi-target allocation are independent of target ordering', () => {
    const rotated = stateFromTokens([{ shape: W }]);
    assert.equal(allocateGoal(rotated, problem({ targetShapeCodes: [S], orientationSensitive: false })).satisfied, true);
    assert.equal(allocateGoal(rotated, problem({ targetShapeCodes: [S], orientationSensitive: true })).satisfied, false);
    const symmetric = stateFromTokens([{ shape: C }]);
    assert.equal(allocateGoal(symmetric, problem({ targetShapeCodes: [C], orientationSensitive: false })).satisfied, true);
    const inventory = stateFromTokens([{ shape: C }, { shape: R }]);
    assert.equal(allocateGoal(inventory, problem({ targetShapeCodes: [C, R] })).satisfied, true);
    assert.equal(allocateGoal(inventory, problem({ targetShapeCodes: [R, C] })).satisfied, true);
    assert.equal(allocateGoal(stateFromTokens([{ shape: C }]), problem({ targetShapeCodes: [C, C] })).satisfied, false);
});

test('pair enumeration honors swapper commutativity, stacker direction, count and incompatibility boundaries', () => {
    const state = stateFromTokens([{ shape: C, count: 2 }, { shape: R }, { shape: 'HuHuHuHuHuHu' }]);
    const swapped = enumerateActions(state, problem({ enabledOperations: ['Swapper'] }))
        .filter(action => action.operation === 'Swapper').map(action => action.inputs.map(input => input.shape).join(','));
    assert.deepEqual(swapped, [C + ',' + C, C + ',' + R]);
    const stacked = enumerateActions(state, problem({ enabledOperations: ['Stacker'] }))
        .filter(action => action.operation === 'Stacker').map(action => action.inputs.map(input => input.shape).join(','));
    assert.deepEqual(stacked, [C + ',' + C, C + ',' + R, R + ',' + C]);
});

test('public solution paths replay IDs, splitter lineage, consume-only steps and binary loss diagnostics', () => {
    const splitRotate = problem({ targetShapeCodes: [W], startingShapeCodes: [S], enabledOperations: ['Rotator CW'], allowSplitting: true });
    const replay = replaySolution(splitRotate, [
        { operation: 'Splitter', inputs: [{ id: 0, shape: S }], outputs: [{ id: 1, shape: S }, { id: 2, shape: S }], params: {} },
        { operation: 'Rotator CW', inputs: [{ id: 1, shape: S }], outputs: [{ id: 3, shape: W }], params: {} },
        { operation: 'Rotator CW', inputs: [{ id: 2, shape: S }], outputs: [{ id: 4, shape: W }], params: {} },
    ], { depth: 3 });
    assert.equal(replay.valid, true);
    assert.equal(replay.diagnostics.minimumUnits, Q / 2);

    const binary = replaySolution(problem({ targetShapeCodes: ['CuCuRuRu'], startingShapeCodes: [C, R, R], enabledOperations: ['Swapper'], allowSplitting: true }), [
        { operation: 'Splitter', inputs: [{ id: 0, shape: C }], outputs: [{ id: 3, shape: C }, { id: 4, shape: C }], params: {} },
        { operation: 'Swapper', inputs: [{ id: 3, shape: C }, { id: 1, shape: R }], outputs: [{ id: 5, shape: 'CuCuRuRu' }, { id: 6, shape: 'RuRuCuCu' }], params: {} },
        { operation: 'Swapper', inputs: [{ id: 4, shape: C }, { id: 2, shape: R }], outputs: [{ id: 7, shape: 'CuCuRuRu' }, { id: 8, shape: 'RuRuCuCu' }], params: {} },
    ], { depth: 3 });
    assert.equal(binary.valid, true);
    assert.equal(binary.diagnostics.implicitBinaryDiscardUnits, Q);
    const equalStack = replaySolution(problem({ targetShapeCodes: ['CuCuCuCu:RuRuRuRu'], startingShapeCodes: [C, R], enabledOperations: ['Stacker'] }), [
        { operation: 'Stacker', inputs: [{ id: 0, shape: C }, { id: 1, shape: R }], outputs: [{ id: 2, shape: 'CuCuCuCu:RuRuRuRu' }], params: {} },
    ], { depth: 1 });
    assert.equal(equalStack.valid, true);
    assert.equal(equalStack.diagnostics.implicitBinaryDiscardUnits, 0);
    assert.equal(replaySolution(splitRotate, [{ operation: 'Splitter', inputs: [{ id: 0, shape: S }], outputs: [{ id: 0, shape: S }, { id: 2, shape: S }] }], { depth: 1 }).valid, false);
});

test('replay covers Painter, Pin Pusher and Crystal Generator with exact color parameters', () => {
    const painter = problem({
        targetShapeCodes: ['CrCrCrCr'], startingShapeCodes: [C], enabledOperations: ['Painter'], cleanPainting: true,
    });
    const painted = [{
        operation: 'Painter', inputs: [{ id: 0, shape: C }], outputs: [{ id: 1, shape: 'CrCrCrCr' }], params: { color: 'r' },
    }];
    assert.equal(replaySolution(painter, painted, { depth: 1 }).valid, true);
    assert.equal(replaySolution(painter, [{ ...painted[0], params: {} }], { depth: 1 }).valid, false, 'Painter needs a color');
    assert.equal(replaySolution(painter, [{ ...painted[0], params: { color: 'z' } }], { depth: 1 }).valid, false, 'unknown colors are rejected');
    assert.equal(replaySolution(painter, [{ ...painted[0], params: { color: 'r', extra: true } }], { depth: 1 }).valid, false, 'extra color parameters are rejected');

    const pin = problem({
        targetShapeCodes: ['P-P-P-P-:CuCuCuCu'], startingShapeCodes: [C], enabledOperations: ['Pin Pusher'], maxLayers: 4,
    });
    const pushed = [{
        operation: 'Pin Pusher', inputs: [{ id: 0, shape: C }], outputs: [{ id: 1, shape: 'P-P-P-P-:CuCuCuCu' }], params: {},
    }];
    assert.equal(replaySolution(pin, pushed, { depth: 1 }).valid, true);
    assert.equal(replaySolution(pin, [{ ...pushed[0], params: { color: 'r' } }], { depth: 1 }).valid, false, 'colorless operations reject parameters');

    const crystal = problem({
        targetShapeCodes: ['cgcgCuCu'], startingShapeCodes: ['----CuCu'], enabledOperations: ['Crystal Generator'],
    });
    const crystallized = [{
        operation: 'Crystal Generator', inputs: [{ id: 0, shape: '----CuCu' }], outputs: [{ id: 1, shape: 'cgcgCuCu' }], params: { color: 'g' },
    }];
    assert.equal(replaySolution(crystal, crystallized, { depth: 1 }).valid, true);
    assert.equal(replaySolution(crystal, [{ ...crystallized[0], params: null }], { depth: 1 }).valid, false, 'Crystal Generator needs object params');
});

test('replay applies the production cleanPainting rule to Painter inputs', () => {
    const layered = 'CuCuCuCu:RuRuRuRu';
    const path = [{
        operation: 'Painter', inputs: [{ id: 0, shape: layered }], outputs: [{ id: 1, shape: 'CuCuCuCu:RrRrRrRr' }], params: { color: 'r' },
    }];
    const unrestricted = problem({
        targetShapeCodes: ['CuCuCuCu:RrRrRrRr'], startingShapeCodes: [layered], enabledOperations: ['Painter'], maxLayers: 4, cleanPainting: false,
    });
    assert.equal(replaySolution(unrestricted, path, { depth: 1 }).valid, true);
    assert.equal(replaySolution({ ...unrestricted, cleanPainting: true }, path, { depth: 1 }).valid, false);

    const alreadyPainted = [{
        operation: 'Painter', inputs: [{ id: 0, shape: 'CrCrCrCr' }], outputs: [{ id: 1, shape: 'CgCgCgCg' }], params: { color: 'g' },
    }];
    assert.equal(replaySolution(problem({
        targetShapeCodes: ['CgCgCgCg'], startingShapeCodes: ['CrCrCrCr'], enabledOperations: ['Painter'], cleanPainting: true,
    }), alreadyPainted, { depth: 1 }).valid, false);
});

test('replay treats only Swapper outputs as an unordered shape multiset while preserving declared ID lineage', () => {
    const swappedThenRotated = problem({
        targetShapeCodes: ['RuCuCuRu'], startingShapeCodes: [C, R], enabledOperations: ['Swapper', 'Rotator CW'],
    });
    const reversedSwap = [
        { operation: 'Swapper', inputs: [{ id: 1, shape: R }, { id: 0, shape: C }], outputs: [{ id: 2, shape: 'CuCuRuRu' }, { id: 3, shape: 'RuRuCuCu' }], params: {} },
        { operation: 'Rotator CW', inputs: [{ id: 2, shape: 'CuCuRuRu' }], outputs: [{ id: 4, shape: 'RuCuCuRu' }], params: {} },
    ];
    assert.equal(replaySolution(swappedThenRotated, reversedSwap, { depth: 2 }).valid, true);
    assert.equal(replaySolution(swappedThenRotated, [{ ...reversedSwap[0], outputs: [{ id: 2, shape: 'CuCuRuRu' }, { id: 3, shape: 'CuCuRuRu' }] }], { depth: 1 }).valid, false);

    const strictStacker = problem({ targetShapeCodes: ['RuRuRuRu:CuCuCuCu'], startingShapeCodes: [C, R], enabledOperations: ['Stacker'] });
    assert.equal(replaySolution(strictStacker, [{ operation: 'Stacker', inputs: [{ id: 1, shape: R }, { id: 0, shape: C }], outputs: [{ id: 2, shape: 'CuCuCuCu:RuRuRuRu' }] }], { depth: 1 }).valid, false);

    const strictCutter = problem({ targetShapeCodes: ['----SuWu'], startingShapeCodes: [S], enabledOperations: ['Cutter'] });
    assert.equal(replaySolution(strictCutter, [{ operation: 'Cutter', inputs: [{ id: 0, shape: S }], outputs: [{ id: 1, shape: 'CuRu----' }, { id: 2, shape: '----SuWu' }] }], { depth: 1 }).valid, false);
});

test('oracle comparison separates semantic depth mismatches and search limits from unsolved cases', () => {
    const present = problem();
    assert.equal(
        compareWithOracle(present, { solutionPath: [], depth: 0 }, { kind: 'found', depth: 1 }).classification,
        'oracle-semantic-mismatch',
    );
    const rotate = problem({ targetShapeCodes: [W], startingShapeCodes: [S], enabledOperations: ['Rotator CW'] });
    assert.equal(
        compareWithOracle(rotate, {
            solutionPath: [{ operation: 'Rotator CW', inputs: [{ id: 0, shape: S }], outputs: [{ id: 1, shape: W }], params: {} }], depth: 1,
        }, { kind: 'found', depth: 0 }).classification,
        'solved-suboptimal',
    );
    assert.equal(
        compareWithOracle(present, { limitReached: true, solutionPath: null, depth: 0 }, { kind: 'exhausted-no-solution' }).classification,
        'production-limit',
    );
    assert.equal(
        compareWithOracle(present, { solutionPath: [], depth: 0 }, { kind: 'oracle-limit' }).classification,
        'oracle-limit',
    );
});

test('reference transition guard stops exactly at its configured budget', () => {
    const guarded = referenceSolve(problem({
        targetShapeCodes: ['CuCuCuCu:RuRuRuRu'],
        startingShapeCodes: [C, R],
        enabledOperations: ['Rotator CW', 'Swapper'],
        maxDepth: 4,
    }), { maxStates: 20_000, maxTransitions: 1 });
    assert.equal(guarded.kind, 'oracle-limit');
    assert.equal(guarded.limit, 'transitions');
    assert.equal(guarded.generatedTransitions, 1);

    const boundaryGoal = referenceSolve(problem({
        targetShapeCodes: [W],
        startingShapeCodes: [S],
        enabledOperations: ['Rotator CW', 'Rotator 180'],
        maxDepth: 2,
    }), { maxStates: 20_000, maxTransitions: 1 });
    assert.equal(boundaryGoal.kind, 'found');
    assert.equal(boundaryGoal.depth, 1);
    assert.equal(boundaryGoal.generatedTransitions, 1);
    assert.deepEqual(boundaryGoal.path.map(step => step.operation), ['Rotator CW']);
});

test('fixed narrow beam fixture remains replayable but is three primitive steps longer', async () => {
    const fixture = problem({
        targetShapeCodes: ['CuCuRuCu'],
        startingShapeCodes: [C, R],
        enabledOperations: ['Rotator CW', 'Swapper'],
        maxLayers: 2,
        maxDepth: 5,
        orientationSensitive: true,
        allowSplitting: false,
        preventWaste: false,
    });
    const reference = referenceSolve(fixture);
    assert.equal(reference.kind, 'found');
    assert.equal(reference.depth, 3);
    assert.ok(reference.maxLayerWidth <= 1_000, JSON.stringify(reference));

    const highCap = await production(fixture, 5_000);
    const highComparison = compareWithOracle(fixture, highCap, reference);
    assert.equal(highComparison.classification, 'optimal-within-domain', JSON.stringify({ highCap, reference, highComparison }));
    assert.equal(highCap.depth, 3);
    assert.equal(highComparison.replay.valid, true);

    const narrowCap = await production(fixture, 1);
    const narrowComparison = compareWithOracle(fixture, narrowCap, reference);
    assert.equal(narrowComparison.classification, 'solved-suboptimal', JSON.stringify({ narrowCap, reference, narrowComparison }));
    assert.equal(narrowCap.depth, 6);
    assert.equal(narrowComparison.depthGap, 3);
    assert.equal(narrowComparison.replay.valid, true);
    // This fixture enables only Rotator CW and Swapper. Its public path has no
    // consume-only transition, so a non-zero diagnostic would be a replay bug.
    assert.equal(narrowComparison.replay.diagnostics.emptyOutputConsumedUnits, 0);
});

test('P4-02a insensitive counterexample needs splitting without throughput discard', async () => {
    const A = 'CuRuCuRu';
    const T = 'CuRuRuCu';
    for (const preventWaste of [false, true]) {
        const withoutSplit = problem({
            targetShapeCodes: [T], startingShapeCodes: [A], enabledOperations: ['Rotator CW', 'Swapper'],
            maxLayers: 2, maxDepth: 4, orientationSensitive: false, allowSplitting: false, preventWaste,
        });
        const noSplitReference = referenceSolve(withoutSplit);
        assert.equal(noSplitReference.kind, 'exhausted-no-solution', JSON.stringify(noSplitReference));

        const withSplit = { ...withoutSplit, allowSplitting: true };
        const initial = stateFromTokens([{ shape: A }]);
        const splitOnly = enumerateActions(initial, withSplit).find(action => action.operation === 'Splitter');
        assert.ok(splitOnly);
        assert.equal(allocateGoal(splitOnly.next, withSplit).satisfied, false, 'splitting alone must not manufacture the target');
        const splitReference = referenceSolve(withSplit);
        assert.equal(splitReference.kind, 'found', JSON.stringify(splitReference));
        assert.equal(splitReference.depth, 3);
        assert.deepEqual(splitReference.path.map(step => step.operation), ['Splitter', 'Rotator CW', 'Swapper']);
        assert.equal(splitReference.path.filter(step => step.operation === 'Splitter').length, 1);
        assert.ok(splitReference.states < 20_000 && splitReference.generatedTransitions < 200_000, JSON.stringify(splitReference));

        for (const cap of [5_000, 100]) {
            const actual = await production(withSplit, cap);
            const replay = replaySolution(withSplit, actual.solutionPath, actual);
            assert.equal(actual.depth, 3, JSON.stringify(actual));
            assert.equal(replay.valid, true, replay.error);
            assert.equal(replay.diagnostics.implicitBinaryDiscardUnits, 0);
        }
    }
});

test('P5-07 cap-2 gate exercises E-003 beam membership on a split-required witness', async () => {
    const A = 'CuRuCuRu';
    const T = 'CuRuRuCu';
    const fixture = problem({
        targetShapeCodes: [T], startingShapeCodes: [A], enabledOperations: ['Rotator CW', 'Swapper'],
        maxLayers: 2, maxDepth: 4, orientationSensitive: false, allowSplitting: true, preventWaste: false,
    });
    const reference = referenceSolve(fixture);
    assert.equal(reference.kind, 'found', JSON.stringify(reference));
    assert.equal(reference.depth, 3);
    assert.equal(reference.states, 14);
    assert.equal(reference.generatedTransitions, 21);
    assert.equal(reference.maxLayerWidth, 8);

    const withoutSplit = referenceSolve({ ...fixture, allowSplitting: false });
    assert.equal(withoutSplit.kind, 'exhausted-no-solution', JSON.stringify(withoutSplit));

    const on = await productionTestOnly(fixture, true);
    const off = await productionTestOnly(fixture, false);
    for (const result of [on, off]) {
        assert.equal(result.depth, 3, JSON.stringify(result));
        assert.equal(result.outcome, 'solved', JSON.stringify(result));
        assert.equal(result.beamPruned, true, JSON.stringify(result));
        assert.equal(replaySolution(fixture, result.solutionPath, result).valid, true);
    }
    assert.ok(on.depth <= off.depth, JSON.stringify({ on, off }));
    assert.ok(on.diagnostics.uniqueBeamRejected + on.diagnostics.uniqueBeamEvicted > 0, JSON.stringify(on.diagnostics));
    assert.ok(on.diagnostics.primaryTieWithDifferentCoarseness > 0, JSON.stringify(on.diagnostics));
    assert.equal(on.statesExplored, 5);
    assert.equal(on.generatedStates, 15);
    assert.equal(on.diagnostics.uniqueBeamRejected, 1);
    assert.equal(on.diagnostics.uniqueBeamEvicted, 1);
    assert.equal(off.statesExplored, 5);
    assert.equal(off.generatedStates, 18);
    assert.equal(off.diagnostics.uniqueBeamRejected, 7);

    const offByDepth = new Map(off.diagnostics.retainedSemanticKeysByDepth.map(layer => [layer.depth, layer.keys]));
    const firstDivergence = on.diagnostics.retainedSemanticKeysByDepth.find(layer =>
        JSON.stringify(layer.keys) !== JSON.stringify(offByDepth.get(layer.depth)),
    );
    assert.equal(firstDivergence.depth, 2);
    assert.deepEqual(firstDivergence.keys, ['CuRuCuRu@2048#1|RuCuRuCu@2048#1', 'RuCuRuCu@2048#2']);
    assert.deepEqual(offByDepth.get(firstDivergence.depth), ['CuRuCuRu@1024#2|CuRuCuRu@2048#1', 'CuRuCuRu@2048#1|RuCuRuCu@2048#1']);
});

test('oracle splitter restrictions cap total use and prohibit a second-generation split', () => {
    const A = 'CuRuCuRu';
    const T = 'CuRuRuCu';
    const fixture = problem({
        targetShapeCodes: [T], startingShapeCodes: [A], enabledOperations: ['Rotator CW', 'Swapper'],
        maxLayers: 2, maxDepth: 4, orientationSensitive: false, allowSplitting: true,
    });
    assert.equal(referenceSolve({ ...fixture, maxSplitterSteps: 0 }).kind, 'exhausted-no-solution');
    assert.equal(referenceSolve({ ...fixture, maxSplitterSteps: 1 }).kind, 'found');
    const half = stateFromTokens([{ shape: A, units: Q / 2 }]);
    assert.equal(enumerateActions(half, fixture, { noNestedSplitting: true }).some(action => action.operation === 'Splitter'), false);
    assert.equal(enumerateActions(stateFromTokens([{ shape: A }]), fixture, { noNestedSplitting: true })
        .some(action => action.operation === 'Splitter'), true);
});

test('P4-02a sensitive counterexample needs a final half-turn after the split recipe', async () => {
    const A = 'CuRuCuRu';
    const T = 'CuRuRuCu';
    const withoutSplit = problem({
        targetShapeCodes: [T], startingShapeCodes: [A], enabledOperations: ['Rotator CW', 'Rotator 180', 'Swapper'],
        maxLayers: 2, maxDepth: 4, orientationSensitive: true, allowSplitting: false, preventWaste: false,
    });
    assert.equal(referenceSolve(withoutSplit).kind, 'exhausted-no-solution');
    const withSplit = { ...withoutSplit, allowSplitting: true };
    const reference = referenceSolve(withSplit);
    assert.equal(reference.kind, 'found', JSON.stringify(reference));
    assert.equal(reference.depth, 4);
    assert.deepEqual(reference.path.map(step => step.operation), ['Splitter', 'Rotator CW', 'Swapper', 'Rotator 180']);
    assert.ok(reference.states < 20_000 && reference.generatedTransitions < 200_000, JSON.stringify(reference));
    const actual = await production(withSplit, 100);
    const replay = replaySolution(withSplit, actual.solutionPath, actual);
    assert.equal(actual.depth, 4, JSON.stringify(actual));
    assert.equal(replay.valid, true, replay.error);
    assert.equal(replay.diagnostics.implicitBinaryDiscardUnits, 0);
});

test('P4-02a preserves an independent six-part target while splitting solves the four-part target', async () => {
    const A = 'CuRuCuRu';
    const T = 'CuRuRuCu';
    const H = 'HuHuHuHuHuHu';
    const withoutSplit = problem({
        targetShapeCodes: [T, H], startingShapeCodes: [A, H], enabledOperations: ['Rotator CW', 'Swapper'],
        maxLayers: 2, maxDepth: 4, orientationSensitive: false, allowSplitting: false, preventWaste: true,
    });
    assert.equal(referenceSolve(withoutSplit).kind, 'exhausted-no-solution');
    const withSplit = { ...withoutSplit, allowSplitting: true };
    const reference = referenceSolve(withSplit);
    assert.equal(reference.kind, 'found', JSON.stringify(reference));
    assert.equal(reference.depth, 3);
    assert.deepEqual(reference.path.map(step => step.operation), ['Splitter', 'Rotator CW', 'Swapper']);
    assert.ok(reference.states < 20_000 && reference.generatedTransitions < 200_000, JSON.stringify(reference));
    const actual = await production(withSplit, 100);
    const replay = replaySolution(withSplit, actual.solutionPath, actual);
    assert.equal(actual.depth, 3, JSON.stringify(actual));
    assert.equal(replay.valid, true, replay.error);
    assert.equal(replay.diagnostics.implicitBinaryDiscardUnits, 0);
});

test('small deterministic reference-production matrix is exact and every public path replays', async () => {
    const matrix = [
        problem(),
        problem({ targetShapeCodes: [W], startingShapeCodes: [S], enabledOperations: ['Rotator CW'], maxDepth: 2 }),
        problem({ targetShapeCodes: ['CuCuRuRu'], startingShapeCodes: [C, R], enabledOperations: ['Swapper'], maxDepth: 2 }),
        problem({ targetShapeCodes: ['CuCuCuCu:RuRuRuRu'], startingShapeCodes: [C, R], enabledOperations: ['Stacker'], maxDepth: 2 }),
        problem({ targetShapeCodes: [W], startingShapeCodes: [S], enabledOperations: ['Rotator CW'], allowSplitting: true, maxDepth: 4 }),
        problem({ targetShapeCodes: [R], startingShapeCodes: [R, '----CuCu'], enabledOperations: ['Half Destroyer'], preventWaste: true, maxDepth: 2 }),
    ];
    for (const instance of matrix) {
        const reference = referenceSolve(instance, { maxStates: 20_000, maxTransitions: 200_000 });
        assert.equal(reference.kind, 'found', JSON.stringify(reference));
        assert.ok(reference.maxLayerWidth <= 1_000, JSON.stringify(reference));
        const actual = await production(instance);
        assert.equal(actual.limitReached, undefined, JSON.stringify(actual));
        const comparison = compareWithOracle(instance, actual, reference);
        assert.equal(comparison.classification, 'optimal-within-domain', JSON.stringify({ actual, reference, comparison }));
    }
});
