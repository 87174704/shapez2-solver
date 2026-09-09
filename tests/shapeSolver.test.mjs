import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.self = { postMessage() {} };

const { BoundedStateCollector, shapeSolver } = await import('../shapeSolver.js');

function solve({
    targetShapeCodes,
    startingShapeCodes,
    enabledOperations = [],
    maxStatesPerLevel = 100,
    orientationSensitive = true,
    allowSplitting = false,
}) {
    return shapeSolver(
        targetShapeCodes,
        startingShapeCodes,
        enabledOperations,
        4,
        maxStatesPerLevel,
        false,
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

test('solver recognizes a target already present at depth zero', async () => {
    const result = await solve({
        targetShapeCodes: ['CuCuCuCu'],
        startingShapeCodes: ['CuCuCuCu'],
    });

    assert.equal(result.depth, 0);
    assert.deepEqual(result.solutionPath, []);
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
