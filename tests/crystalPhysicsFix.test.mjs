import test from 'node:test';
import assert from 'node:assert/strict';
import * as production from '../shapeOperations.js';
import { decode, encode, supportModel, supportClosure, components, gravity, transform, physicalOutputs } from './helpers/independentPhysics.mjs';
import { probe } from './helpers/physicsProbe.mjs';

const { module: inspected } = await probe();
const config = new production.ShapeOperationConfig(4);
function run(operation, inputs, params = {}) {
    const names = { 'Pin Pusher': 'pushPin', Stacker: 'stack', Cutter: 'cut', 'Half Destroyer': 'halfCut', Swapper: 'swapHalves' };
    return production[names[operation]](...inputs.map(code => production.Shape.fromShapeCode(code)), config).map(s => s.toShapeCode());
}
function checkGravity(code) {
    const rows = decode(code), stages = [];
    globalThis.__physicsProbe = (stage, layers, supported) => stages.push({ stage, rows: layers.map(r => r.map(p => p.shape + p.color)), supported: supported?.map(r => [...r]) });
    let actual;
    try { actual = inspected._makeLayersFall(inspected.Shape.fromShapeCode(code).layers); }
    finally { delete globalThis.__physicsProbe; }
    for (const s of stages.filter(s => s.supported)) {
        assert.deepEqual(s.supported, supportModel(s.rows), code + ' support');
        assert.deepEqual(s.supported, supportModel(s.rows, true), code + ' reverse visitation');
        assert.deepEqual(s.supported, supportClosure(s.rows), code + ' all-pairs closure');
    }
    const after = stages.find(s => s.stage === 'deleted').rows;
    for (const group of components(rows)) {
        const removed = group.filter(([l, q]) => after[l][q][0] !== 'c').length;
        assert.ok(removed === 0 || removed === group.length, 'R1 whole component');
    }
    assert.equal(encode(actual.map(r => r.map(p => p.shape + p.color))), encode(gravity(rows)), code + ' analytical gravity');
    return stages;
}

test('[VERIFIED graph / game UNKNOWN] original counterexample has a floor path for every crystal', () => {
    assert.equal(production.SHAPE_OPERATIONS_SEMANTICS, 'shape-operations-v2-support-closure');
    const code = '------P-:------Cu:cucu--cu';
    const states = checkGravity(code)[0].supported;
    assert.deepEqual(states[2], [true, true, false, true]);
    const output = decode(run('Pin Pusher', ['------Cu:cucu--cu'])[0]);
    for (const q of [0, 1, 3]) assert.equal(output[2][q], 'cu');
    // This tests R3 support and R1 preservation, not a game-certified exact output.
});
for (const [name, code] of [
    ['ordinary multipath', '------Cu:CuCu--Cu'],
    ['crystal multipath', '------Cu:crcg--cb'],
    ['floorless crystal ring', '--------:crcgcbcw'],
    ['supported crystal ring', 'Cu------:crcgcbcw'],
    ['unsupported ordinary ring falls', '--------:CuCuCuCu'],
    ['cross-layer suspension from above', '------Cu:------Cu:cr----cb:cgcbcrcw'],
    ['pins do not transmit horizontal support', 'Cu------:P-P-----'],
    ['four-layer cross-color component', 'Cu------:crcg--cb:--cw----:--cy----'],
    ['disconnected crystals', 'Cu------:cr--cb--'],
    ['ordinary production candidate 032', 'RyCy----:Cr------:CwCwCu--:--------:----Cu--'],
    ['ordinary production candidate 034', '--Sg----:--WgCuCu:--------:RrCr----'],
]) test('[VERIFIED graph / INFERRED motion] ' + name, () => checkGravity(code));

for (const [name, code, seed, expected] of [
    ['same layer wrap', 'cucu--cu', [0, 1], '--------'],
    ['mixed colors wrap', 'crcg--cb', [0, 1], '--------'],
    ['cross-layer mixed colors', 'crcg--cb:--cw----', [0, 3], '--------:--------'],
    ['disconnected diagonal', 'cr--cb--', [0, 0], '----cb--'],
    ['four-layer vertical', 'cr------:cg------:cb------:cw------', [2, 0], '--------:--------:--------:--------'],
]) test('[VERIFIED R1] full component shattering: ' + name, () => {
    const shape = inspected.Shape.fromShapeCode(code);
    inspected._breakCrystals(shape.layers, ...seed);
    assert.equal(shape.toShapeCode(), expected);
});

test('[VERIFIED R1/R3 model] unsupported component shatters; disconnected supported crystal survives', () => {
    assert.deepEqual(run('Pin Pusher', ['Cu------:--crcg--']), ['P-------:Cu------']);
    assert.deepEqual(run('Pin Pusher', ['Cu------:cr--cb--']), ['P-------:Cu------:cr------']);
});
test('[INFERRED model / game UNKNOWN] Pin Pusher and Stacker commute with rotation and reflection', () => {
    for (const operation of ['Pin Pusher', 'Stacker']) for (const mirror of [false, true]) for (let k = 0; k < 4; k++) {
        const inputs = ['------Cu:crcg--cb', ...(operation === 'Stacker' ? ['Ru------'] : [])];
        const modified = inputs.map(c => transform(c, k, mirror));
        assert.deepEqual(run(operation, modified), run(operation, inputs).map(c => transform(c, k, mirror)));
        assert.deepEqual(run(operation, modified), physicalOutputs(operation, modified));
    }
});
test('[VERIFIED R1/R2] four-layer Pin Pusher clips fusion boundary as one event', () => {
    const input = 'CuCuCuCu:RuRuRuRu:cr------:cb------';
    assert.deepEqual(run('Pin Pusher', [input]), ['P-P-P-P-:CuCuCuCu:RuRuRuRu']);
});
test('[INFERRED model] Stacker ordered collision, truncation, and crystal landing controls', () => {
    for (const inputs of [['------Cu:cucu--cu', 'Ru------'], ['Cu------', 'Ru------'], ['Cu------', 'cr------'], ['Cu------:Cu------:Cu------:Cu------', 'Ru------']]) {
        assert.deepEqual(run('Stacker', inputs), physicalOutputs('Stacker', inputs));
        assert.ok(run('Stacker', inputs)[0].split(':').length <= 4);
    }
});
test('[VERIFIED repository material contract] independent painter preserves refined and exotic colors', () => {
    const input = 'XrYbcrP-';
    const actual = production.topPaint(production.Shape.fromShapeCode(input), 'w', config).map(s => s.toShapeCode());
    assert.deepEqual(physicalOutputs('Painter', [input], { color: 'w' }), [input]);
    assert.deepEqual(actual, [input]);
});
test('[VERIFIED graph] bounded diverse grid, both traversal orders and all-pairs closure', () => {
    let seed = 20261029;
    for (let i = 0; i < 2048; i++) {
        const rows = Array.from({ length: 1 + i % 9 }, () => Array.from({ length: 4 }, () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return ['--', 'P-', 'Cu', 'Ru', 'cr', 'cg'][seed % 6];
        }));
        checkGravity(encode(rows));
    }
});
