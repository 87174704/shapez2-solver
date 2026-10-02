import test from 'node:test';
import assert from 'node:assert/strict';

import { COLOR_CODES } from '../shapeConstants.js';
import {
    Shape,
    ShapeOperationConfig,
    InvalidOperationInputs,
    cut,
    genCrystal,
    halfCut,
    pushPin,
    rotate180,
    rotate90CCW,
    rotate90CW,
    stack,
    swapHalves,
    topPaint,
} from '../shapeOperations.js';

globalThis.self = { postMessage() {} };
const { shapeExplorerTestOnly } = await import('../shapeSolver.js');

const REFERENCE_OPERATIONS = Object.freeze({
    'Rotator CW': { fn: rotate90CW, inputCount: 1 },
    'Rotator CCW': { fn: rotate90CCW, inputCount: 1 },
    'Rotator 180': { fn: rotate180, inputCount: 1 },
    'Half Destroyer': { fn: halfCut, inputCount: 1 },
    Cutter: { fn: cut, inputCount: 1 },
    Swapper: { fn: swapHalves, inputCount: 2, commutative: true },
    Stacker: { fn: stack, inputCount: 2 },
    Painter: { fn: topPaint, inputCount: 1, needsColor: true },
    'Pin Pusher': { fn: pushPin, inputCount: 1 },
    'Crystal Generator': { fn: genCrystal, inputCount: 1, needsColor: true },
});

const REFERENCE_COLORS = [...new Set(Object.values(COLOR_CODES))];

function referenceClosure({ startingShapeCodes, enabledOperations, depthLimit, maxLayers = 4 }) {
    const config = new ShapeOperationConfig(maxLayers);
    const available = new Map();
    for (const code of startingShapeCodes) {
        const shape = Shape.fromShapeCode(code);
        if (!shape.isEmpty() && !available.has(code)) available.set(code, shape);
    }
    let frontier = new Set(available.keys());
    const byDepth = [new Set(available.keys())];

    function apply(op, inputCodes, color, next) {
        const inputs = inputCodes.map(code => available.get(code));
        let outputs;
        try {
            outputs = op.needsColor ? op.fn(inputs[0], color, config) : op.fn(...inputs, config);
        } catch (error) {
            if (error instanceof InvalidOperationInputs) return;
            throw error;
        }
        for (const output of outputs) {
            if (output.isEmpty()) continue;
            const code = output.toShapeCode();
            if (available.has(code)) continue;
            available.set(code, output);
            next.add(code);
        }
    }

    for (let depth = 1; depth <= depthLimit && frontier.size > 0; depth++) {
        const allCodes = [...available.keys()];
        const frontierCodes = [...frontier];
        const next = new Set();
        for (const name of [...new Set(enabledOperations)]) {
            const op = REFERENCE_OPERATIONS[name];
            if (!op) continue;
            if (op.inputCount === 1) {
                for (const code of frontierCodes) {
                    for (const color of op.needsColor ? REFERENCE_COLORS : [null]) {
                        apply(op, [code], color, next);
                    }
                }
            } else if (op.commutative) {
                for (let left = 0; left < allCodes.length; left++) {
                    for (let right = left; right < allCodes.length; right++) {
                        if (!frontier.has(allCodes[left]) && !frontier.has(allCodes[right])) continue;
                        apply(op, [allCodes[left], allCodes[right]], null, next);
                    }
                }
            } else {
                for (const left of allCodes) for (const right of allCodes) {
                    if (!frontier.has(left) && !frontier.has(right)) continue;
                    apply(op, [left, right], null, next);
                }
            }
        }
        frontier = next;
        byDepth.push(new Set(available.keys()));
    }
    return { codes: new Set(available.keys()), byDepth };
}

function codes(result) {
    return new Set(result.shapes.map(shape => shape.code));
}

function assertSameCodes(actual, expected) {
    assert.deepEqual([...actual].sort(), [...expected].sort());
}

test('Explorer matches reusable-input reference closure by expression height', async () => {
    const fixtures = [
        {
            startingShapeCodes: ['Cu------', 'CuCu----'],
            enabledOperations: ['Rotator CW', 'Cutter', 'Stacker'],
            depthLimit: 2,
            maxLayers: 4,
        },
        {
            startingShapeCodes: ['--RuP-P-', 'crRucgcr'],
            enabledOperations: ['Swapper', 'Rotator 180'],
            depthLimit: 2,
            maxLayers: 4,
        },
    ];

    for (const fixture of fixtures) {
        for (let depth = 0; depth <= fixture.depthLimit; depth++) {
            const instance = { ...fixture, depthLimit: depth };
            const expected = referenceClosure(instance);
            const actual = await shapeExplorerTestOnly(instance);
            assert.equal(actual.outcome, 'complete');
            assertSameCodes(codes(actual), expected.codes);
        }
    }
});

test('Explorer keeps both ordered Stacker directions and reusable self-pairs', async () => {
    const result = await shapeExplorerTestOnly({
        startingShapeCodes: ['Cu------', 'CuCu----'],
        enabledOperations: ['Stacker'],
        depthLimit: 1,
        maxLayers: 4,
    });

    assertSameCodes(codes(result), new Set([
        'Cu------',
        'CuCu----',
        'Cu------:Cu------',
        'Cu------:CuCu----',
        'CuCu----:Cu------',
        'CuCu----:CuCu----',
    ]));
    assert.equal(result.attempts, 4);
});

test('an unchanged multi-output sibling cannot suppress a novel sibling', async () => {
    const result = await shapeExplorerTestOnly({
        startingShapeCodes: ['--RuP-P-', 'crRucgcr'],
        enabledOperations: ['Swapper'],
        depthLimit: 1,
        maxLayers: 4,
    });

    assert.ok(codes(result).has('--Ru----'));
    assert.equal(result.ops.length, 1);
    const outputId = result.shapes.find(shape => shape.code === '--Ru----').id;
    assert.ok(result.edges.some(edge => edge.source === result.ops[0].id && edge.target === outputId));
});

test('mixed-part invalid calls are isolated while compatible calls continue', async () => {
    const result = await shapeExplorerTestOnly({
        startingShapeCodes: ['CuCuCuCu', 'HuHuHuHuHuHu', 'RuRuRuRu'],
        enabledOperations: ['Swapper'],
        depthLimit: 1,
        maxLayers: 4,
    });

    assert.equal(result.outcome, 'complete');
    assert.equal(result.invalidAttempts, 2);
    assert.ok(codes(result).has('CuCuRuRu'));
    assert.ok(codes(result).has('RuRuCuCu'));
});

test('colored operations cover the full color domain while empty outputs and pure cycles stay out', async () => {
    const painted = await shapeExplorerTestOnly({
        startingShapeCodes: ['Cu------'],
        enabledOperations: ['Painter'],
        depthLimit: 1,
        maxLayers: 4,
    });
    assert.equal(painted.attempts, REFERENCE_COLORS.length);
    for (const color of REFERENCE_COLORS.filter(color => color !== 'u')) {
        assert.ok(painted.ops.some(op => op.params.color === color));
    }

    const emptyOnly = await shapeExplorerTestOnly({
        startingShapeCodes: ['----CuCu'],
        enabledOperations: ['Half Destroyer'],
        depthLimit: 1,
        maxLayers: 4,
    });
    assert.equal(emptyOnly.shapes.length, 1);
    assert.equal(emptyOnly.ops.length, 0);
    assert.equal(emptyOnly.edges.length, 0);

    const cycleOnly = await shapeExplorerTestOnly({
        startingShapeCodes: ['CuCuCuCu'],
        enabledOperations: ['Rotator 180'],
        depthLimit: 1,
        maxLayers: 4,
    });
    assert.equal(cycleOnly.ops.length, 0);
});

test('explicit Explorer depth zero executes no operation', async () => {
    const result = await shapeExplorerTestOnly({
        startingShapeCodes: ['Cu------'],
        enabledOperations: ['Rotator CW'],
        depthLimit: 0,
        maxLayers: 4,
    });
    assert.equal(result.outcome, 'complete');
    assert.equal(result.depthReached, 0);
    assert.equal(result.attempts, 0);
    assert.equal(result.shapes.length, 1);
});

test('empty starting shapes are ignored before shape and serialization admission', async () => {
    const result = await shapeExplorerTestOnly({
        startingShapeCodes: ['Cu------', '--------'],
        enabledOperations: [],
        depthLimit: 0,
        maxLayers: 4,
    }, { limits: { maxShapes: 1, maxSerializedBytes: 512 } });
    assert.equal(result.outcome, 'complete');
    assert.deepEqual(result.shapes.map(shape => shape.code), ['Cu------']);
    assert.ok(result.serializedBytes <= 512);
});

test('public Worker protocol preserves explicit depth zero and returns the Explorer envelope', async () => {
    const messages = [];
    const previousPostMessage = globalThis.self.postMessage;
    globalThis.self.postMessage = message => messages.push(message);
    try {
        await globalThis.self.onmessage({
            data: {
                action: 'explore',
                data: {
                    startingShapeCodes: ['Cu------'],
                    enabledOperations: ['Rotator CW'],
                    depthLimit: 0,
                    maxLayers: 4,
                },
            },
        });
    } finally {
        globalThis.self.postMessage = previousPostMessage;
    }
    assert.equal(messages.length, 1);
    assert.equal(messages[0].type, 'result');
    assert.equal(messages[0].result.outcome, 'complete');
    assert.equal(messages[0].result.depthReached, 0);
    assert.equal(messages[0].result.attempts, 0);
});

test('Explorer resource limits stop before half-committing a productive call', async () => {
    const instance = {
        startingShapeCodes: ['Cu------'],
        enabledOperations: ['Rotator CW'],
        depthLimit: 1,
        maxLayers: 4,
    };
    const cases = [
        ['attempts', { maxAttempts: 0 }],
        ['shapes', { maxShapes: 1 }],
        ['operations', { maxOperations: 0 }],
        ['edges', { maxEdges: 1 }],
    ];
    for (const [reason, limits] of cases) {
        const result = await shapeExplorerTestOnly(instance, { limits });
        assert.equal(result.outcome, 'limit');
        assert.equal(result.complete, false);
        assert.equal(result.limitReason, reason);
        assert.equal(result.depthReached, 0);
        assert.equal(result.partialDepth, 1);
        assert.equal(result.shapes.length, 1);
        assert.equal(result.ops.length, 0);
        assert.equal(result.edges.length, 0);
    }

    const exact = await shapeExplorerTestOnly(instance, {
        limits: { maxAttempts: 1, maxShapes: 2, maxOperations: 1, maxEdges: 2 },
    });
    assert.equal(exact.outcome, 'complete');
    assert.equal(exact.shapes.length, 2);
    assert.equal(exact.ops.length, 1);
    assert.equal(exact.edges.length, 2);
});

test('Explorer time and serialization limits return classified partial graphs', async () => {
    const timed = {
        startingShapeCodes: ['Cu------'],
        enabledOperations: ['Rotator CW'],
        depthLimit: 1,
        maxLayers: 4,
    };
    const times = [0, 9, 10];
    const timeResult = await shapeExplorerTestOnly(timed, {
        limits: { maxSearchTimeMs: 10 },
        now: () => times.shift() ?? 10,
    });
    assert.equal(timeResult.outcome, 'limit');
    assert.equal(timeResult.limitReason, 'time');
    assert.equal(timeResult.ops.length, 0);

    const serializationResult = await shapeExplorerTestOnly({
        startingShapeCodes: ['Cu------'],
        enabledOperations: ['Painter', 'Rotator CW', 'Stacker'],
        depthLimit: 3,
        maxLayers: 4,
    }, { limits: { maxSerializedBytes: 4096 } });
    assert.equal(serializationResult.outcome, 'limit');
    assert.equal(serializationResult.limitReason, 'serialization');
    assert.ok(serializationResult.serializedBytes <= 4096);
    assert.ok(new TextEncoder().encode(JSON.stringify(serializationResult)).length <= 4096);
});
