import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
globalThis.self = { postMessage() {} };
const { shapeSolver, strictRoutingTestOnly: seam, hybridRoutingTestOnly: hybrid } = await import('../shapeSolver.js');
import { replaySolution } from './helpers/shapeSolverOracle.mjs';
import { replay as independentReplay } from '../tools/release1/replay.mjs';
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
        { cleanPainting: null }, { cleanPainting: undefined }, { preventWaste: true }, { targetShapeCodes: ['P-------'] },
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

function checkPublicResult(p, result, solved) {
    assert.equal(result.outcome, solved ? 'solved' : 'exhausted', JSON.stringify(result));
    if (!solved) {
        assert.equal(result.solutionPath, null);
        return;
    }
    assert.ok(Array.isArray(result.solutionPath));
    const production = replaySolution(p, result.solutionPath, result);
    const independent = independentReplay(p, result.solutionPath);
    assert.equal(production.valid, true, production.error);
    assert.equal(independent.valid, true, independent.error);
}

test('public API paint controls: colored/uncolored × exact/rotatable × clean/unrestricted', async t => {
    for (const source of ['Cb------', 'Cu------']) {
        for (const orientationSensitive of [false, true]) {
            for (const cleanPainting of [true, false]) {
                await t.test(`${source}, exact=${orientationSensitive}, clean=${cleanPainting}`, async () => {
                    const p = { ...base, targetShapeCodes: ['Cr------'], startingShapeCodes: [source],
                        enabledOperations: ['Painter'], orientationSensitive, cleanPainting };
                    checkPublicResult(p, await invoke(p), source === 'Cu------' || !cleanPainting);
                });
            }
        }
    }
});

test('public API constructive constraints and core fallback all use dual replay', async t => {
    const paint = { ...base, targetShapeCodes: ['Cr------'], startingShapeCodes: ['Cu------'],
        enabledOperations: ['Painter'] };
    const cases = [
        ['same color needs no repaint', { startingShapeCodes: ['Cr------'] }, true],
        ['Painter disabled', { enabledOperations: [] }, false],
        ['splitting domain uses core', { allowSplitting: true }, true],
        ['uncolored target cannot erase paint', { targetShapeCodes: ['Cu------'], startingShapeCodes: ['Cb------'] }, false],
        ['multi-layer clean Painter forbidden', { startingShapeCodes: ['Cu------:Ru------'],
            targetShapeCodes: ['Cu------:Rr------'] }, false],
        ['multi-layer unrestricted Painter', { startingShapeCodes: ['Cu------:Ru------'],
            targetShapeCodes: ['Cu------:Rr------'], cleanPainting: false }, true],
        ['paint atoms before layering', { startingShapeCodes: ['Cu------', 'Ru------'],
            targetShapeCodes: ['Cr------:Rr------'], enabledOperations: ['Painter', 'Stacker'] }, true],
        ['cannot reuse a single input', { startingShapeCodes: ['Cu------'], targetShapeCodes: ['Cu------:Cu------'],
            enabledOperations: ['Stacker'] }, false],
        ['two finite copies suffice', { startingShapeCodes: ['Cu------', 'Cu------'], targetShapeCodes: ['Cu------:Cu------'],
            enabledOperations: ['Stacker'] }, true],
        ['Stacker disabled', { startingShapeCodes: ['Cu------', 'Cu------'], targetShapeCodes: ['Cu------:Cu------'],
            enabledOperations: [] }, false],
        ['Cutter disabled', { startingShapeCodes: ['CuRu----'], targetShapeCodes: ['Cu------'],
            enabledOperations: ['Rotator CW'] }, false],
        ['Crystal Generator disabled', { startingShapeCodes: ['Cu------'], targetShapeCodes: ['cr------'],
            enabledOperations: ['Painter'] }, false],
        ['rotation disabled', { startingShapeCodes: ['Ru------'], targetShapeCodes: ['--Ru----'],
            enabledOperations: [], orientationSensitive: true }, false],
        ['rotated goal allowed without Rotator', { startingShapeCodes: ['Ru------'], targetShapeCodes: ['--Ru----'],
            enabledOperations: [], orientationSensitive: false }, true],
        ['unused resource is waste', { startingShapeCodes: ['Cr------', 'Ru------'], preventWaste: true }, false],
        ['unused resource allowed', { startingShapeCodes: ['Cr------', 'Ru------'] }, true],
        ['Cutter byproduct is waste', { startingShapeCodes: ['RuRuCuCu'], targetShapeCodes: ['RuRu----'],
            enabledOperations: ['Cutter'], preventWaste: true }, false],
        ['Cutter byproduct allowed', { startingShapeCodes: ['RuRuCuCu'], targetShapeCodes: ['RuRu----'],
            enabledOperations: ['Cutter'] }, true],
        ['layer cap', { startingShapeCodes: ['Cu------', 'Cu------', 'Cu------'], targetShapeCodes: ['Cu------:Cu------:Cu------'],
            enabledOperations: ['Stacker'], maxLayers: 2 }, false],
        ['shared pool rejects recoloring', { startingShapeCodes: ['CbCb----'], targetShapeCodes: ['CrCr----'],
            enabledOperations: ['Cutter', 'Rotator CW', 'Stacker', 'Painter'] }, false],
        ['shared pool paints uncolored atoms', { startingShapeCodes: ['CuCu----'], targetShapeCodes: ['CrCr----'],
            enabledOperations: ['Cutter', 'Rotator CW', 'Stacker', 'Painter'] }, true],
        ['matching reserves precolored atom', { startingShapeCodes: ['Cb------', 'Cu------'], targetShapeCodes: ['Cr------:Cb------'],
            enabledOperations: ['Painter', 'Stacker'] }, true],
        ['Pin stage rejects recoloring', { startingShapeCodes: ['Cb------'], targetShapeCodes: ['P-------:Cr------'],
            enabledOperations: ['Painter', 'Pin Pusher'] }, false],
        ['Pin stage paints clean atom', { startingShapeCodes: ['Cu------'], targetShapeCodes: ['P-------:Cr------'],
            enabledOperations: ['Painter', 'Pin Pusher'] }, true],
        ['Pin Pusher disabled', { startingShapeCodes: ['Cu------'], targetShapeCodes: ['P-------:Cu------'],
            enabledOperations: [] }, false],
        ['already assembled fallback', { startingShapeCodes: ['Cu------:Ru------'], targetShapeCodes: ['Cu------:Ru------'],
            enabledOperations: [] }, true],
    ];
    for (const orientationSensitive of [false, true]) {
        for (const [name, delta, solved] of cases) {
            // Two explicitly rotatable fixtures exercise fallback with no legal exact construction.
            await t.test(`${name}, exact=${orientationSensitive}`, async () => {
                const p = { ...paint, orientationSensitive, ...delta };
                const result = await invoke(p);
                checkPublicResult(p, result, solved);
                if (p.allowSplitting) {
                    assert.equal(result.hybridConstructiveAttempt, undefined);
                    assert.equal(result.strictConstructiveAttempt, undefined);
                }
                if (['already assembled fallback', 'rotated goal allowed without Rotator'].includes(name)) {
                    assert.equal(result.solverRoute, 'general-search');
                    assert.deepEqual(result.solutionPath, []);
                    const attempt = result.hybridConstructiveAttempt ?? result.strictConstructiveAttempt;
                    assert.equal(attempt.fallback, true);
                    assert.ok(result.searchWallMs >= attempt.elapsedMs);
                }
            });
        }
    }
});

test('hybrid acceptance fails closed for invalid candidates and keeps strict domain narrow', async () => {
    const p = { ...base, orientationSensitive: false };
    assert.equal(hybrid.validate(p, [step]).valid, true);
    assert.equal(seam.validate(p, [step]).reason, 'unsupported-plan');
    const rejects = [
        [p, []],
        [{ ...p, enabledOperations: [] }, [step]],
        [p, [{ ...step, inputs: [{ id: 9, shape: 'Ru------' }] }]],
        [p, [step, { ...step, outputs: [{ id: 2, shape: '--Ru----' }] }]],
        [p, [{ ...step, outputs: [] }]],
        [p, [{ ...step, outputs: [{ id: 1, shape: '----Ru--' }] }]],
        [p, [{ ...step, operation: 'Splitter' }]],
        [{ ...p, allowSplitting: true }, [step]],
        [{ ...p, preventWaste: true }, [step]],
        [{ ...p, maxLayers: 2 }, [step]],
        [{ ...p, targetShapeCodes: ['--Ru----', '--Ru----'] }, [step]],
        [p, Array(769).fill(step)],
        [{ ...p, enabledOperations: ['Painter'], targetShapeCodes: ['Cr------'], startingShapeCodes: ['Cb------'] },
            [{ operation: 'Painter', inputs: [{ id: 0, shape: 'Cb------' }], outputs: [{ id: 1, shape: 'Cr------' }], params: { color: 'r' } }]],
        [{ ...p, enabledOperations: ['Painter'], targetShapeCodes: ['Cr------'], startingShapeCodes: ['Cu------'] },
            [{ operation: 'Painter', inputs: [{ id: 0, shape: 'Cu------' }], outputs: [{ id: 1, shape: 'Cb------' }], params: { color: 'b' } },
                { operation: 'Painter', inputs: [{ id: 1, shape: 'Cb------' }], outputs: [{ id: 2, shape: 'Cr------' }], params: { color: 'r' } }]],
        [{ ...p, enabledOperations: ['Painter'], targetShapeCodes: ['Cu------:Rr------'], startingShapeCodes: ['Cu------:Ru------'] },
            [{ operation: 'Painter', inputs: [{ id: 0, shape: 'Cu------:Ru------' }], outputs: [{ id: 1, shape: 'Cu------:Rr------' }], params: { color: 'r' } }]],
        [{ ...p, enabledOperations: ['Stacker'], targetShapeCodes: ['Ru------:Ru------'] },
            [{ operation: 'Stacker', inputs: [{ id: 0, shape: 'Ru------' }, { id: 0, shape: 'Ru------' }],
                outputs: [{ id: 1, shape: 'Ru------:Ru------' }] }]],
    ];
    for (const [input, path] of rejects) {
        const candidate = { solutionPath: path, depth: path.length, outcome: 'solved' };
        const r = await hybrid.tryHybridConstructive(input, { construct: async () => candidate });
        assert.equal(r.candidate, null, JSON.stringify(path));
        assert.equal(r.attempt.fallback, true);
    }
    const good = { solutionPath: [step], depth: 1, outcome: 'solved' };
    assert.equal((await hybrid.tryHybridConstructive(p, { construct: async () => good })).candidate, good);
    for (const construct of [async () => { throw Error('failure'); }, async () => ({}),
        async () => ({ ...good, depth: 2 }), async () => ({ ...good, outcome: 'exhausted' })]) {
        assert.equal((await hybrid.tryHybridConstructive(p, { construct })).candidate, null);
    }
    let reads = 0;
    const late = await hybrid.tryHybridConstructive(p, { now: () => ++reads < 4 ? 0 : 12001,
        construct: async () => good });
    assert.equal(late.attempt.reason, 'budget');
});
