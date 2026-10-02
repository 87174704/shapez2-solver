import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.self = { postMessage() {} };
const { shapeSolverTestOnly } = await import('../shapeSolver.js');

const base = {
    maxLayers: 4, maxStatesPerLevel: 2, preventWaste: false,
    orientationSensitive: true, allowSplitting: false, cleanPainting: false,
};
const logical = result => ({ outcome: result.outcome, limitReason: result.limitReason,
    depth: result.depth, statesExplored: result.statesExplored,
    generatedStates: result.generatedStates, beamPruned: result.beamPruned,
    solutionPath: result.solutionPath });

test('passive trace preserves ordered Swapper outputs, Stacker operands, and FIFO frontier', async () => {
    const input = { ...base, targetShapeCodes: ['HuHuHuHu'],
        startingShapeCodes: ['CuCuCuCu', 'RuRuRuRu'],
        enabledOperations: ['Swapper', 'Stacker'] };
    const limits = { maxGeneratedStates: 4 };
    const plain = await shapeSolverTestOnly(input, { limits });
    const observer = { events: [] };
    const seen = await shapeSolverTestOnly(input, { limits, observer });
    assert.deepEqual(logical(seen), logical(plain));
    assert.deepEqual(observer.events.find(event => event.type === 'initial-inventory')
        .inventory.map(row => row.code), ['CuCuCuCu', 'RuRuRuRu']);
    assert.deepEqual(observer.events.filter(event => event.type === 'operation-output').slice(0, 3)
        .map(event => [event.operation, event.inputShapeIds, event.outputCodes]), [
            ['Swapper', [1, 2], ['CuCuRuRu', 'RuRuCuCu']],
            ['Stacker', [1, 2], ['CuCuCuCu:RuRuRuRu']],
            ['Stacker', [2, 1], ['RuRuRuRu:CuCuCuCu']],
        ]);
    assert.deepEqual(observer.events.find(event => event.type === 'frontier').states
        .map(state => state.inventory.map(row => row.code)), [
            ['CuCuRuRu', 'RuRuCuCu'], ['CuCuCuCu:RuRuRuRu'],
        ]);
    assert.deepEqual(observer.events.at(-1).type, 'limit');
    assert.equal(observer.data.d024ShapeSlots, 7);
    assert.equal(observer.data.operationOutputBirthIds.size, 4);
    assert.equal(observer.data.descriptorPayloadUtf16Bytes,
        observer.data.descriptors.reduce((sum, row) => sum + row.payloadUtf16Bytes, 0));
    assert.equal(observer.data.operationAttempts, 4);
});

test('passive observer never materializes an additional ranking-precheck loser', async () => {
    const input = { ...base, maxStatesPerLevel: 1,
        targetShapeCodes: ['HuHuHuHu'], startingShapeCodes: ['CuRuSuWu'],
        enabledOperations: ['Rotator CW', 'Rotator CCW', 'Rotator 180'] };
    const offProfile = { sampleEvery: 100000 };
    const onProfile = { sampleEvery: 100000 };
    const plain = await shapeSolverTestOnly(input, { profile: offProfile });
    const observer = { events: [] };
    const seen = await shapeSolverTestOnly(input, { profile: onProfile, observer });
    assert.deepEqual(logical(seen), logical(plain));
    assert.deepEqual(onProfile.data.counters, offProfile.data.counters);
    assert.ok(observer.data.collectorLazyRejects > 0);
    assert.equal(observer.data.candidateMaterializations, onProfile.data.counters.materializedCandidates);
    assert.ok(observer.data.candidateMaterializations < seen.generatedStates);
    const lazy = observer.events.findIndex(event => event.type === 'collector-lazy-reject');
    assert.equal(observer.events[lazy - 1].type, 'ranking-pre-reject');
    assert.notEqual(observer.events[lazy + 1]?.type, 'candidate-materialized');
    assert.ok(observer.data.finalRetainedIds.size > 0);
    assert.ok(observer.data.expandedIds.size > 0);
});

test('ordered trace can stream events without retaining an event array', async () => {
    const input = { ...base, targetShapeCodes: ['SuWuCuRu'],
        startingShapeCodes: ['CuRuSuWu'], enabledOperations: ['Rotator CW'] };
    let previousOrdinal = -1;
    const types = [];
    const observer = { onEvent(event) {
        assert.equal(event.ordinal, previousOrdinal + 1);
        previousOrdinal = event.ordinal;
        types.push(event.type);
    } };
    const result = await shapeSolverTestOnly(input, { observer });
    assert.equal(result.outcome, 'solved');
    assert.ok(types.includes('initial-inventory'));
    assert.ok(types.includes('operation-output'));
    assert.ok(types.includes('candidate-ranking'));
    assert.ok(types.includes('frontier'));
    assert.ok(types.includes('candidate-goal-check'));
    assert.equal(observer.events, undefined);
});

test('D-024 shape, generated, visited and attempted-action time boundaries are unchanged', async () => {
    const rotation = { ...base, maxStatesPerLevel: 10,
        targetShapeCodes: ['SuWuCuRu'], startingShapeCodes: ['CuRuSuWu'],
        enabledOperations: ['Rotator CW'] };
    for (const limits of [
        { maxInternedShapes: 1 }, { maxInternedShapes: 2 },
        { maxInternedShapes: 3 }, { maxInternedShapes: 4 },
        { maxGeneratedStates: 1 }, { maxGeneratedStates: 2 },
        { maxTotalStates: 1 }, { maxTotalStates: 2 },
    ]) {
        const plain = await shapeSolverTestOnly(rotation, { limits });
        const observer = {};
        const seen = await shapeSolverTestOnly(rotation, { limits, observer });
        assert.deepEqual(logical(seen), logical(plain), JSON.stringify(limits));
        assert.ok(observer.data.d024ShapeSlots <= (limits.maxInternedShapes ?? 150000));
        assert.equal(observer.data.d024ShapeSlots, observer.data.descriptors.length);
    }
    const invalid = { ...base, targetShapeCodes: ['RuRuRuRu'],
        startingShapeCodes: ['CuCuCuCu', 'HuHuHuHuHuHu'],
        enabledOperations: ['Swapper'] };
    for (const elapsed of [9, 10, 11]) {
        const clock = () => { let calls = 0; return () => calls++ < 3 ? 0 : elapsed; };
        const options = { limits: { maxSearchTimeMs: 10, operationTimeCheckInterval: 1 } };
        const plain = await shapeSolverTestOnly(invalid, { ...options, now: clock() });
        const observer = { events: [] };
        const seen = await shapeSolverTestOnly(invalid, { ...options, now: clock(), observer });
        assert.deepEqual(logical(seen), logical(plain));
        assert.equal(observer.data.operationAttempts, 1);
        assert.equal(observer.events.find(event => event.type === 'operation-output').outputShapeIds, null);
    }
});

test('partial Cutter overflow consumes the first output slot before attempt/time checks', async () => {
    const input = { ...base, targetShapeCodes: ['HuHuHuHu'],
        startingShapeCodes: ['CuCuCuCu'], enabledOperations: ['Cutter'] };
    const limits = { maxInternedShapes: 3, maxSearchTimeMs: 10,
        operationTimeCheckInterval: 1 };
    const clockAtAttempt = () => { let calls = 0; return () => calls++ < 3 ? 0 : 10; };
    const plainCap = await shapeSolverTestOnly(input, { limits, now: clockAtAttempt() });
    const capObserver = { events: [] };
    const cap = await shapeSolverTestOnly(input, { limits, now: clockAtAttempt(), observer: capObserver });
    assert.deepEqual(logical(cap), logical(plainCap));
    assert.equal(cap.limitReason, 'shape-universe');
    assert.equal(cap.generatedStates, 0);
    assert.equal(capObserver.data.operationAttempts, 0);
    assert.equal(capObserver.data.d024ShapeSlots, 3);
    assert.equal(capObserver.data.operationOutputBirthIds.size, 1);
    assert.equal(capObserver.data.d024OverflowAttempts, 1);
    const births = capObserver.events.filter(event => event.type === 'shape-birth');
    assert.equal(births.at(-1).code, '----CuCu');
    const overflow = capObserver.events.find(event => event.type === 'shape-slot-overflow');
    assert.equal(overflow.code, 'CuCu----');
    assert.ok(overflow.ordinal < capObserver.events.find(event => event.type === 'operation-output').ordinal);
    assert.equal(capObserver.events.some(event => event.type === 'operation-attempt'), false);
});

test('ordered trace distinguishes legal empty output from invalid inputs', async () => {
    const empty = { ...base, preventWaste: true,
        targetShapeCodes: ['HuHuHuHu'], startingShapeCodes: ['----CuCu'],
        enabledOperations: ['Half Destroyer'] };
    const emptyObserver = { events: [] };
    const emptyResult = await shapeSolverTestOnly(empty, { observer: emptyObserver });
    assert.equal(emptyResult.generatedStates, 1);
    const emptyOutput = emptyObserver.events.find(event => event.type === 'operation-output');
    assert.deepEqual(emptyOutput.outputShapeIds, []);
    assert.deepEqual(emptyOutput.outputCodes, []);
    assert.equal(emptyObserver.data.operationAttempts, 1);

    const invalid = { ...base, targetShapeCodes: ['RuRuRuRu'],
        startingShapeCodes: ['CuCuCuCu', 'HuHuHuHuHuHu'],
        enabledOperations: ['Swapper'] };
    const invalidObserver = { events: [] };
    const invalidResult = await shapeSolverTestOnly(invalid, { observer: invalidObserver });
    assert.equal(invalidResult.generatedStates, 0);
    const invalidOutput = invalidObserver.events.find(event => event.type === 'operation-output');
    assert.equal(invalidOutput.outputShapeIds, null);
    assert.equal(invalidOutput.outputCodes, null);
    assert.equal(invalidObserver.data.operationAttempts, 1);
});
