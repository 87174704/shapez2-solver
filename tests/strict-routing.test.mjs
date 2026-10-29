import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
globalThis.self = { postMessage() {} };
const { shapeSolver, strictRoutingTestOnly: seam } = await import('../shapeSolver.js');
const base = { targetShapeCodes: ['--Ru----'], startingShapeCodes: ['Ru------'],
    enabledOperations: ['Rotator CW'], maxLayers: 4, maxStatesPerLevel: 100,
    preventWaste: false, orientationSensitive: true, allowSplitting: false, cleanPainting: true };
const step = { operation: 'Rotator CW', inputs: [{ id: 0, shape: 'Ru------' }],
    outputs: [{ id: 1, shape: '--Ru----' }], params: {} };
const invoke = p => shapeSolver(p.targetShapeCodes, p.startingShapeCodes, p.enabledOperations,
    p.maxLayers, p.maxStatesPerLevel, p.preventWaste, p.orientationSensitive, p.allowSplitting, p.cleanPainting);

test('prespecified holdout bytes remain locked', () => {
    const bytes = fs.readFileSync(new URL('./strict-routing/holdouts.json', import.meta.url));
    const lock = JSON.parse(fs.readFileSync(new URL('./strict-routing/holdout-lock.json', import.meta.url)));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), lock.sha256);
});
test('exact direction and finite inventory acceptance controls', () => {
    assert.equal(seam.validate(base, [step]).valid, true);
    const rejects = [
        [base, []],
        [{ ...base, targetShapeCodes: ['----Ru--'] }, [step]],
        [base, [step, { ...step, outputs: [{ id: 2, shape: '--Ru----' }] }]],
        [{ ...base, startingShapeCodes: [] }, [step]],
        [base, [{ ...step, outputs: [{ id: 0, shape: '--Ru----' }] }]],
        [base, [{ ...step, outputs: [{ id: 1, shape: '----Ru--' }] }]],
        [base, [{ ...step, outputs: [] }]],
        [base, [{ ...step, params: { color: 'r' } }]],
        [base, [{ ...step, params: null }]],
        [{ ...base, enabledOperations: [] }, [step]],
        [base, [{ ...step, inputs: [...step.inputs, ...step.inputs] }]],
        [base, [{ ...step, operation: 'Splitter' }]],
    ];
    for (const [p, path] of rejects) assert.equal(seam.validate(p, path).valid, false, JSON.stringify(path));
    const stack = { operation: 'Stacker', inputs: [{ id: 0, shape: 'Ru------' }, { id: 0, shape: 'Ru------' }],
        outputs: [{ id: 1, shape: 'Ru------:Ru------' }] };
    const p = { ...base, enabledOperations: ['Stacker'], targetShapeCodes: ['Ru------:Ru------'] };
    assert.equal(seam.validate(p, [stack]).reason, 'input-inventory');
    assert.equal(seam.validate({ ...p, startingShapeCodes: ['Ru------', 'Ru------'] },
        [{ ...stack, inputs: [{ id: 0, shape: 'Ru------' }, { id: 1, shape: 'Ru------' }],
            outputs: [{ id: 2, shape: 'Ru------:Ru------' }] }]).valid, true);
});
test('paint parameter, clean paint, byproduct and waste controls', () => {
    const p = { ...base, targetShapeCodes: ['Cr------'], startingShapeCodes: ['Cu------'], enabledOperations: ['Painter'] };
    const paint = { operation: 'Painter', inputs: [{ id: 0, shape: 'Cu------' }],
        outputs: [{ id: 1, shape: 'Cr------' }], params: { color: 'r' } };
    assert.equal(seam.validate(p, [paint]).valid, true);
    for (const params of [{}, { color: 'z' }, { color: 'r', extra: 1 }]) {
        assert.equal(seam.validate(p, [{ ...paint, params }]).valid, false);
    }
    assert.equal(seam.validate({ ...p, startingShapeCodes: ['Cb------'] },
        [{ ...paint, inputs: [{ id: 0, shape: 'Cb------' }] }]).reason, 'clean-painting');
    const cut = { operation: 'Cutter', inputs: [{ id: 0, shape: 'RuRuRuRu' }],
        outputs: [{ id: 1, shape: '----RuRu' }, { id: 2, shape: 'RuRu----' }] };
    const q = { ...base, startingShapeCodes: ['RuRuRuRu'], targetShapeCodes: ['RuRu----'], enabledOperations: ['Cutter'] };
    assert.equal(seam.validate(q, [cut]).valid, true);
    assert.equal(seam.validate(q, [{ ...cut, outputs: cut.outputs.slice(0, 1) }]).valid, false);
    assert.equal(seam.validate({ ...q, preventWaste: true }, [cut]).reason, 'waste');
});
test('constructor errors, invalid plans and deadline reject to fallback; replay is charged', async () => {
    const good = { solutionPath: [step], architectureStatus: 'solved' };
    for (const construct of [async () => { throw Error('failure'); }, async () => ({}),
        async () => ({ solutionPath: [] })]) {
        const r = await seam.tryStrictConstructive(base, { construct });
        assert.equal(r.candidate, null); assert.equal(r.attempt.fallback, true);
    }
    let time = 0;
    const late = await seam.tryStrictConstructive(base, { now: () => time,
        construct: async (_, config) => { assert.equal(config.maxWallMs, 50); time = 51; return good; } });
    assert.equal(late.attempt.reason, 'budget');
    let reads = 0;
    const replayLate = await seam.tryStrictConstructive(base, { now: () => ++reads < 4 ? 0 : 51,
        construct: async () => good });
    assert.equal(replayLate.attempt.reason, 'budget');
    const accepted = await seam.tryStrictConstructive(base, { construct: async () => good });
    assert.equal(accepted.candidate, good);
});
test('default production routing and real construction failure fallback retain core solution', async () => {
    const result = await invoke(base);
    assert.equal(seam.validate(base, result.solutionPath).valid, true);
    assert.ok(result.strictConstructiveAttempt);
    // Already-assembled multilevel source: old constructor cannot extract it
    // using no operations, but core must still accept its zero-step solution.
    const p = { ...base, targetShapeCodes: ['Ru------:Cu------'], startingShapeCodes: ['Ru------:Cu------'], enabledOperations: [] };
    const fallback = await invoke(p);
    assert.equal(fallback.solverRoute, 'general-search');
    assert.equal(fallback.strictConstructiveAttempt.fallback, true);
    assert.deepEqual(fallback.solutionPath, []);
    assert.ok(fallback.searchWallMs >= fallback.strictConstructiveAttempt.elapsedMs);
});
test('unsupported domains keep original dispatch', () => {
    for (const delta of [{ orientationSensitive: false }, { allowSplitting: true }, { maxLayers: 2 },
        { cleanPainting: false }, { preventWaste: true }, { targetShapeCodes: ['P-------'] },
        { targetShapeCodes: ['cr------'] }, { startingShapeCodes: Array(65).fill('Ru------') }]) {
        assert.equal(seam.strictOrdinaryEligible({ ...base, ...delta }), false);
    }
});
test('worker invokes production strict routing without a feature flag', async () => {
    const messages = []; self.postMessage = m => messages.push(m);
    await self.onmessage({ data: { action: 'solve', data: base } });
    assert.equal(messages.at(-1).type, 'result');
    assert.ok(messages.at(-1).result.strictConstructiveAttempt);
});
