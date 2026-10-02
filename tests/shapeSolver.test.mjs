import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.self = { postMessage() {} };

const { BoundedStateCollector, shapeSolver } = await import('../shapeSolver.js');

function solve({
    targetShapeCodes,
    startingShapeCodes,
    enabledOperations = [],
    maxStatesPerLevel = 100,
    preventWaste = false,
    orientationSensitive = true,
    allowSplitting = false,
}) {
    return shapeSolver(
        targetShapeCodes,
        startingShapeCodes,
        enabledOperations,
        4,
        maxStatesPerLevel,
        preventWaste,
        orientationSensitive,
        allowSplitting,
        false
    );
}

test('bounded collector retains only the best unique states', () => {
    const collector = new BoundedStateCollector(2, new Set(['visited']));
    let materialized = 0;
    const add = (key, score) => collector.consider(key, score, () => {
        materialized += 1;
        return { key, score };
    });

    assert.equal(add('low', 0.1), true);
    assert.equal(add('high', 0.9), true);
    assert.equal(add('middle', 0.5), true);
    assert.equal(add('rejected', 0.05), false);
    assert.equal(add('high', 0.9), false);
    assert.equal(add('visited', 1), false);

    assert.deepEqual(collector.toBestFirstStates().map(state => state.key), ['high', 'middle']);
    assert.equal(materialized, 3);
});

test('bounded collector latches only unique beam pruning and stays lazy afterwards', () => {
    const beamPruned = { value: false };
    const collector = new BoundedStateCollector(1, new Set(['visited']), false, null, beamPruned);
    let candidateFactories = 0;
    let stateFactories = 0;
    const lazy = (key, score) => collector.considerLazy(score, 0, () => {
        candidateFactories += 1;
        return {
            stateKey: key,
            createState: () => {
                stateFactories += 1;
                return { key, score };
            },
        };
    });

    assert.equal(lazy('retained', 0.5), true);
    assert.equal(lazy('visited', 0.4), false);
    assert.equal(lazy('retained', 0.4), false);
    assert.equal(beamPruned.value, false);
    assert.equal(lazy('unique-beam-loser', 0.4), false);
    assert.equal(beamPruned.value, true);
    assert.equal(lazy('lazy-after-latch', 0.4), false);
    assert.equal(candidateFactories, 4);
    assert.equal(stateFactories, 1);
    assert.equal(collector.consideredCount, 5);
});

test('bounded collector marks a unique eviction as beam pruning', () => {
    const beamPruned = { value: false };
    const collector = new BoundedStateCollector(1, new Set(), false, null, beamPruned);
    collector.consider('low', 0.1, () => ({ key: 'low' }));
    collector.consider('high', 0.9, () => ({ key: 'high' }));
    assert.equal(beamPruned.value, true);
});

test('diagnostic collector partitions every non-retained event exactly', () => {
    const diagnostics = {
        uniqueBeamRejected: 0,
        uniqueBeamEvicted: 0,
        visitedDuplicate: 0,
        retainedDuplicate: 0,
        primaryTieWithDifferentCoarseness: 0,
        admittedByCoarseness: 0,
    };
    const beamPruned = { value: false };
    const collector = new BoundedStateCollector(1, new Set(['visited']), false, diagnostics, beamPruned);
    const add = (key, score) => collector.consider(key, score, () => ({ key }));

    assert.equal(add('retained', 0.5), true);
    assert.equal(add('visited', 0.4), false);
    assert.equal(add('retained', 0.4), false);
    assert.equal(add('unique-loser', 0.4), false);
    assert.equal(add('unique-winner', 0.9), true);

    const classifiedEvents = diagnostics.visitedDuplicate
        + diagnostics.retainedDuplicate
        + diagnostics.uniqueBeamRejected
        + diagnostics.uniqueBeamEvicted;
    assert.equal(collector.consideredCount - collector.size, classifiedEvents);
    assert.deepEqual({
        visitedDuplicate: diagnostics.visitedDuplicate,
        retainedDuplicate: diagnostics.retainedDuplicate,
        uniqueBeamRejected: diagnostics.uniqueBeamRejected,
        uniqueBeamEvicted: diagnostics.uniqueBeamEvicted,
    }, {
        visitedDuplicate: 1,
        retainedDuplicate: 1,
        uniqueBeamRejected: 1,
        uniqueBeamEvicted: 1,
    });
    assert.equal(beamPruned.value, true);
});

test('bounded collector matches a full stable sort', () => {
    const collector = new BoundedStateCollector(7, new Set());
    const candidates = Array.from({ length: 80 }, (_, index) => {
        const keyIndex = (index * 17) % 31;
        return {
            key: `state-${keyIndex}`,
            score: ((keyIndex * 37) % 19) / 19,
            sequence: index,
        };
    });

    for (const candidate of candidates) {
        collector.consider(candidate.key, candidate.score, () => candidate);
    }

    const firstByKey = new Map();
    for (const candidate of candidates) {
        if (!firstByKey.has(candidate.key)) firstByKey.set(candidate.key, candidate);
    }
    const expected = [...firstByKey.values()]
        .sort((a, b) => b.score - a.score || a.sequence - b.sequence)
        .slice(0, 7)
        .map(candidate => candidate.key);

    assert.deepEqual(collector.toBestFirstStates().map(candidate => candidate.key), expected);
});

test('bounded collector uses coarseness only after an exactly equal primary score', () => {
    const retain = (collector, key, score, coarseness) => {
        collector.consider(key, score, () => ({ key }), coarseness);
        return collector.toBestFirstStates().map(entry => entry.key);
    };

    const primary = new BoundedStateCollector(1, new Set(), true);
    retain(primary, 'coarse-low-primary', 0.4, 10);
    assert.deepEqual(retain(primary, 'fine-high-primary', 0.5, 0), ['fine-high-primary']);

    const secondary = new BoundedStateCollector(1, new Set(), true);
    retain(secondary, 'fine-first', 0.5, 0.25);
    assert.deepEqual(retain(secondary, 'coarse-second', 0.5, 0.5), ['coarse-second']);

    const sequence = new BoundedStateCollector(1, new Set(), true);
    retain(sequence, 'first', 0.5, 0.5);
    assert.deepEqual(retain(sequence, 'second', 0.5, 0.5), ['first']);

    const disabled = new BoundedStateCollector(1, new Set());
    retain(disabled, 'first', 0.5, 0.25);
    assert.deepEqual(retain(disabled, 'second', 0.5, 0.5), ['first']);
});

test('coarseness heap ordering matches stable top-K across eviction, duplicates, and visited keys', () => {
    const collector = new BoundedStateCollector(5, new Set(['visited']), true);
    const candidates = [
        { key: 'a', score: 0.8, coarseness: 0.2 },
        { key: 'b', score: 0.8, coarseness: 0.6 },
        { key: 'c', score: 0.9, coarseness: 0.1 },
        { key: 'visited', score: 0.99, coarseness: 0.9 },
        { key: 'd', score: 0.7, coarseness: 0.9 },
        { key: 'e', score: 0.8, coarseness: 0.6 },
        { key: 'b', score: 0.95, coarseness: 0.9 },
        { key: 'f', score: 0.85, coarseness: 0.2 },
        { key: 'h', score: 0.91, coarseness: 0 },
    ];
    for (const candidate of candidates) {
        collector.consider(candidate.key, candidate.score, () => candidate, candidate.coarseness);
    }
    const firstEligibleByKey = new Map();
    candidates.forEach((candidate, sequence) => {
        if (candidate.key !== 'visited' && !firstEligibleByKey.has(candidate.key)) {
            firstEligibleByKey.set(candidate.key, { ...candidate, sequence });
        }
    });
    const expected = [...firstEligibleByKey.values()]
        .sort((a, b) => b.score - a.score || b.coarseness - a.coarseness || a.sequence - b.sequence)
        .slice(0, 5)
        .map(candidate => candidate.key);
    assert.deepEqual(collector.toBestFirstStates().map(candidate => candidate.key), expected);
});

test('coarseness square-total formulas match explicit throughput/count inventories', () => {
    const squareTotal = inventory => inventory.reduce(
        (total, { throughput, count }) => total + throughput * throughput * count,
        0,
    );
    const unaryInitial = [{ throughput: 1, count: 1 }, { throughput: 0.5, count: 2 }];
    const unaryInitialTotal = squareTotal(unaryInitial);
    for (const outputCount of [0, 1, 2]) {
        const formula = unaryInitialTotal - 0.5 ** 2 + outputCount * 0.5 ** 2;
        assert.equal(formula, squareTotal([{ throughput: 1, count: 1 }, { throughput: 0.5, count: 1 + outputCount }]));
    }

    const binaryInitial = [{ throughput: 1, count: 1 }, { throughput: 0.5, count: 1 }, { throughput: 0.25, count: 1 }];
    const binaryInitialTotal = squareTotal(binaryInitial);
    for (const outputCount of [1, 2]) {
        const formula = binaryInitialTotal - 1 ** 2 - 0.5 ** 2 + outputCount * 0.5 ** 2;
        assert.equal(formula, squareTotal([{ throughput: 0.25, count: 1 }, { throughput: 0.5, count: outputCount }]));
    }

    const sameTokenInitial = [{ throughput: 0.5, count: 3 }];
    for (const outputCount of [1, 2]) {
        const formula = squareTotal(sameTokenInitial) - 2 * 0.5 ** 2 + outputCount * 0.5 ** 2;
        assert.equal(formula, squareTotal([{ throughput: 0.5, count: 1 + outputCount }]));
    }
});

test('solver recognizes a target already present at depth zero', async () => {
    const result = await solve({
        targetShapeCodes: ['CuCuCuCu'],
        startingShapeCodes: ['CuCuCuCu'],
    });

    assert.equal(result.depth, 0);
    assert.deepEqual(result.solutionPath, []);
    assert.equal(result.outcome, 'solved');
    assert.equal(result.beamPruned, false);
});

test('solver classifies a naturally exhausted no-result as exhaustive', async () => {
    const result = await solve({
        targetShapeCodes: ['RuRuRuRu'],
        startingShapeCodes: ['CuCuCuCu'],
    });

    assert.equal(result.solutionPath, null);
    assert.equal(result.outcome, 'exhausted');
    assert.equal(result.beamPruned, false);
});

test('solver labels a beam-pruned no-result without claiming exhaustion', async () => {
    const result = await solve({
        targetShapeCodes: ['HuHuHuHu'],
        startingShapeCodes: ['CuRuSuWu', 'RuSuWuCu'],
        enabledOperations: ['Rotator CW'],
        maxStatesPerLevel: 1,
    });

    assert.equal(result.solutionPath, null);
    assert.equal(result.outcome, 'not-found-pruned');
    assert.equal(result.beamPruned, true);
});

test('solver returns immediately when a generated successor is the target', async () => {
    const result = await solve({
        targetShapeCodes: ['WuCuRuSu'],
        startingShapeCodes: ['CuRuSuWu'],
        enabledOperations: ['Rotator CW'],
    });

    assert.equal(result.depth, 1);
    assert.equal(result.solutionPath.length, 1);
    assert.equal(result.solutionPath[0].operation, 'Rotator CW');
    assert.equal(result.solutionPath[0].outputs[0].shape, 'WuCuRuSu');
    assert.equal(result.outcome, 'solved');
    assert.equal(result.beamPruned, false);
});

test('interned throughput tokens preserve splitting-mode solutions', async () => {
    const result = await solve({
        targetShapeCodes: ['WuCuRuSu'],
        startingShapeCodes: ['CuRuSuWu'],
        enabledOperations: ['Rotator CW'],
        allowSplitting: true,
    });

    assert.equal(result.depth, 1);
    assert.equal(result.solutionPath[0].outputs[0].shape, 'WuCuRuSu');
});

test('half destroyer can consume a shape without producing output', async () => {
    const result = await solve({
        targetShapeCodes: ['RuRuRuRu'],
        startingShapeCodes: ['RuRuRuRu', '----CuCu'],
        enabledOperations: ['Half Destroyer'],
        preventWaste: true,
    });

    assert.equal(result.depth, 1);
    assert.equal(result.solutionPath.length, 1);
    assert.equal(result.solutionPath[0].operation, 'Half Destroyer');
    assert.equal(result.solutionPath[0].inputs[0].shape, '----CuCu');
    assert.deepEqual(result.solutionPath[0].outputs, []);
});

test('swapper skips mixed-part pairs and still solves with a compatible pair', async () => {
    const result = await solve({
        targetShapeCodes: ['CuCuRuRu'],
        startingShapeCodes: ['CuCuCuCu', 'HuHuHuHuHuHu', 'RuRuRuRu'],
        enabledOperations: ['Swapper'],
    });

    assert.equal(result.depth, 1);
    assert.equal(result.solutionPath[0].operation, 'Swapper');
    assert.ok(result.solutionPath[0].outputs.some(output => output.shape === 'CuCuRuRu'));
});

test('stacker skips mixed-part pairs and still solves with a compatible pair', async () => {
    const result = await solve({
        targetShapeCodes: ['CuCuCuCu:RuRuRuRu'],
        startingShapeCodes: ['CuCuCuCu', 'HuHuHuHuHuHu', 'RuRuRuRu'],
        enabledOperations: ['Stacker'],
    });

    assert.equal(result.depth, 1);
    assert.equal(result.solutionPath[0].operation, 'Stacker');
    assert.equal(result.solutionPath[0].outputs[0].shape, 'CuCuCuCu:RuRuRuRu');
});

test('omni swapper integration case still resolves with the bounded search', async () => {
    const target = 'CuRuSuWu';
    const result = await solve({
        targetShapeCodes: [target],
        startingShapeCodes: ['CuCuCuCu', 'RuRuRuRu', 'SuSuSuSu', 'WuWuWuWu'],
        enabledOperations: [
            'Rotator CW', 'Rotator CCW', 'Rotator 180', 'Half Destroyer', 'Cutter',
            'Swapper', 'Stacker', 'Painter', 'Pin Pusher', 'Crystal Generator',
        ],
        maxStatesPerLevel: 1000,
        orientationSensitive: false,
    });

    assert.ok(result.solutionPath);
    assert.equal(result.depth, result.solutionPath.length);
    const acceptableRotations = new Set(['CuRuSuWu', 'WuCuRuSu', 'SuWuCuRu', 'RuSuWuCu']);
    assert.ok(result.solutionPath.at(-1).outputs.some(output => acceptableRotations.has(output.shape)));
});
