import assert from 'node:assert/strict';
import test from 'node:test';
import { disposeInventory } from '../constructive/dispose-inventory.js';
import { validateDisposalPlan } from '../constructive/validate-strict-plan.js';
import { replaySolution } from './helpers/shapeSolverOracle.mjs';
import { replay } from '../tools/release1/replay.mjs';
import * as physics from '../shapeOperations.js';
globalThis.self = { postMessage() {} };
const { shapeSolver, shapeSolverTestOnly, strictRoutingTestOnly: seam } = await import('../shapeSolver.js');
const definitions = Object.fromEntries(Object.entries({
    'Half Destroyer': ['halfCut', 1], 'Rotator 180': ['rotate180', 1], 'Rotator CW': ['rotate90CW', 1],
    'Rotator CCW': ['rotate90CCW', 1], Cutter: ['cut', 1], Swapper: ['swapHalves', 2],
}).map(([op, [fn, inputCount]]) => [op, { fn: physics[fn], inputCount }]));
const base = { targetShapeCodes: ['P-----Cu:cr------'], startingShapeCodes: Array(4).fill('CuCuCuCu'),
    enabledOperations: ['Rotator CW', 'Rotator CCW', 'Rotator 180', 'Half Destroyer', 'Cutter', 'Swapper',
        'Stacker', 'Painter', 'Pin Pusher', 'Crystal Generator'],
    maxLayers: 4, maxStatesPerLevel: 3000, preventWaste: true,
    orientationSensitive: true, allowSplitting: false, cleanPainting: true };
const missed = { outcome: 'limit', limitReached: true, limitReason: 'generated-states',
    solutionPath: null, depth: 28, statesExplored: 100, generatedStates: 5000000 };
const invoke = p => shapeSolver(p.targetShapeCodes, p.startingShapeCodes, p.enabledOperations,
    p.maxLayers, p.maxStatesPerLevel, p.preventWaste, p.orientationSensitive, p.allowSplitting, p.cleanPainting);
function dual(p, path) {
    const production = replaySolution(p, path, { outcome: 'solved', depth: path.length });
    const independent = replay(p, path);
    assert.equal(production.valid, true, production.error);
    assert.equal(independent.valid, true, independent.error);
    return independent;
}
function atom(shapes, enabledOperations = ['Half Destroyer', 'Rotator 180']) {
    return { ...base, targetShapeCodes: ['Ru------'], startingShapeCodes: ['Ru------', ...shapes], enabledOperations };
}
const inventory = p => p.startingShapeCodes.map((shape, id) => ({ id, shape }));

test('public preventWaste state-limit recovery automatically disposes of every finite leftover', async () => {
    const result = await invoke(base);
    assert.equal(result.outcome, 'solved');
    assert.equal(result.solverRoute, 'waste-disposal-constructive');
    assert.equal(result.generalSearchAttempt.limitReason, 'generated-states');
    assert.equal(result.generalSearchAttempt.generatedStates, 5000000);
    assert.equal(result.wasteDisposalAttempt.accepted, true);
    assert.equal(result.wasteDisposalAttempt.budgetMs, 50);
    assert.equal(result.depth, 51);
    assert.equal(dual(base, result.solutionPath).terminal.length, 1);
});

test('bounded disposal handles single cells, half shapes, all materials and four-layer inventories', () => {
    const shapes = ['Cu------', '----CuCu', 'CuCuCuCu', 'P-------', 'cr------', 'crcrcrcr',
        'P-------:cr------:Xu------:Yg------', 'CucrcrCu:--cbcb--:P-----P-:SuSuSuSu', 'Ru------'];
    for (const rot of ['Rotator 180', 'Rotator CW', 'Rotator CCW']) {
        const p = atom(shapes, ['Half Destroyer', rot]);
        const d = disposeInventory(p, [], inventory(p), 0);
        assert.equal(d.valid, true, d.reason);
        assert.ok(d.steps.length <= shapes.length * (rot === 'Rotator 180' ? 3 : 4));
        assert.deepEqual(dual(p, d.steps).terminal, [[0, 'Ru------']]);
        assert.ok(d.steps.every(s => s.inputs.every(i => i.id !== 0)));
    }
});

test('disposal retains every Cutter byproduct and never reuses a spent occurrence ID', () => {
    const p = atom(['CuCuCuCu']);
    p.enabledOperations.push('Cutter');
    const prefix = [{ operation: 'Cutter', inputs: [{ id: 1, shape: 'CuCuCuCu' }], params: {},
        outputs: [{ id: 2, shape: '----CuCu' }, { id: 9, shape: 'CuCu----' }] }];
    const checked = validateDisposalPlan({ ...p, preventWaste: false }, prefix, definitions);
    assert.equal(checked.valid, true);
    assert.equal(checked.inventory.length, 3);
    const d = disposeInventory(p, prefix, checked.inventory, 0);
    assert.equal(d.valid, true);
    assert.ok(d.steps.flatMap(s => s.outputs).every(o => o.id > 9));
    assert.deepEqual(dual(p, [...prefix, ...d.steps]).terminal, [[0, 'Ru------']]);
    assert.equal(validateDisposalPlan(p, prefix, definitions).reason, 'waste');
    const fake = [{ ...prefix[0], outputs: prefix[0].outputs.slice(1) }];
    assert.equal(validateDisposalPlan({ ...p, preventWaste: false }, fake, definitions).reason, 'physics');
});

test('missing operations, protected identity, work and time boundaries reject without partial success', () => {
    for (const [p, reason] of [
        [atom(['Cu------'], ['Rotator 180']), 'missing-half-destroyer'],
        [atom(['Cu------'], ['Half Destroyer']), 'missing-half-turn'],
        [atom(['CuCuCuCu'], []), 'missing-half-destroyer'],
    ]) {
        const d = disposeInventory(p, [], inventory(p), 0);
        assert.equal(d.reason, reason);
        assert.equal(d.steps, null);
    }
    const p = atom(['CuCuCuCu']), original = inventory(p);
    assert.equal(disposeInventory(p, [], original, 99).reason, 'target-identity');
    assert.equal(disposeInventory(p, [], original, 0, { maxOperations: 2 }).reason, 'operation-budget');
    assert.equal(disposeInventory(p, [], original, 0, { maxOperations: 3 }).valid, true);
    assert.equal(disposeInventory(p, [], original, 0, { expired: () => true }).reason, 'budget');
    assert.deepEqual(original, inventory(p));
    for (const shapes of [[], ['----Cu--'], ['crcrcrcr']]) {
        const q = atom(shapes, shapes.length ? ['Half Destroyer'] : []);
        const d = disposeInventory(q, [], inventory(q), 0);
        assert.equal(d.valid, true);
        dual(q, d.steps);
    }
});

test('recovery generalizes to other original parameters and shapes under the cumulative 50ms cap', async () => {
    for (const [target, source, count, orientationSensitive, cleanPainting] of [
        ['P-----Sr:cg------', 'SbSbSbSb', 4, false, false],
        ['RuP-----:--cb----', 'RuRuRuRu', 4, true, true],
        ['cwP---P-:--cw--cw', 'CuCuCuCu', 9, true, true],
        ['crCucrCu:crCucrCu:cbcbcbcb', 'CuCuCuCu', 6, false, true],
    ]) {
        const p = { ...base, targetShapeCodes: [target], startingShapeCodes: Array(count).fill(source), orientationSensitive, cleanPainting };
        const r = await seam.recoverWaste(p, missed, 0);
        assert.equal(r.outcome, 'solved', r.wasteDisposalAttempt?.reason);
        assert.equal(dual(p, r.solutionPath).terminal.length, 1);
    }
});

test('the combined plan respects the exact 256-operation boundary', () => {
    const p = atom(['Cu------']);
    for (const length of [253, 254]) {
        const prefix = Array.from({ length }, (_, i) => ({ operation: 'Half Destroyer', params: {},
            inputs: [{ id: i + 1, shape: 'Cu------' }], outputs: [{ id: i + 2, shape: 'Cu------' }] }));
        const checked = validateDisposalPlan({ ...p, preventWaste: false }, prefix, definitions);
        assert.equal(checked.valid, true);
        const d = disposeInventory(p, prefix, checked.inventory, 0);
        if (length === 253) {
            assert.equal(d.valid, true);
            const path = [...prefix, ...d.steps];
            assert.equal(path.length, 256);
            assert.equal(validateDisposalPlan(p, path, definitions).valid, true);
            dual(p, path);
            assert.equal(validateDisposalPlan(p, [...path, path.at(-1)], definitions).reason, 'unsupported-plan');
        } else assert.equal(d.reason, 'operation-budget');
    }
});

test('original core success and preventWaste=false results remain unchanged', async () => {
    for (const p of [atom([]), atom(['----CuCu'], ['Half Destroyer']),
        { ...atom([]), preventWaste: false, cleanPainting: false },
        { ...base, targetShapeCodes: ['P-------:Cu------'], startingShapeCodes: ['Cu------'], enabledOperations: ['Pin Pusher'] }]) {
        const core = await shapeSolverTestOnly(p);
        assert.equal(core.outcome, 'solved');
        assert.deepEqual(await invoke(p), core);
    }
});

test('routing is bounded and excludes time limits, unsupported parameters and disabled erasure', async () => {
    const construct = () => assert.fail('must not construct');
    assert.equal(seam.wasteRecoveryEligible(base), true);
    assert.equal(seam.wasteRecoveryEligible({ ...base, startingShapeCodes: Array(64).fill('Cu------') }), true);
    for (const delta of [{ preventWaste: false }, { maxLayers: 2 }, { allowSplitting: true },
        { targetShapeCodes: ['Cu------', 'Ru------'] }, { cleanPainting: null }, { orientationSensitive: null },
        { enabledOperations: ['Cutter'] }, { startingShapeCodes: Array(65).fill('Cu------') },
        { targetShapeCodes: ['Pr------'] }, { startingShapeCodes: ['CuCuCuCuCuCu'] }]) {
        const p = { ...base, ...delta };
        assert.equal(seam.wasteRecoveryEligible(p), false);
        assert.equal(await seam.recoverWaste(p, missed, 0, { construct }), missed);
    }
    for (const r of [null, { outcome: 'solved' }, { outcome: 'exhausted' }, { ...missed, limitReason: 'time' }, { ...missed, limitReason: 'unknown' }]) {
        assert.equal(await seam.recoverWaste(base, r, 0, { construct }), r);
    }
});

test('recovery rejects invalid prefix physics, lost inputs, reuse, metadata and disposal failure', async () => {
    const p = atom(['Cu------']);
    const good = { outcome: 'solved', depth: 0, solutionPath: [] };
    for (const result of [missed, { ...missed, outcome: 'not-found-pruned' },
        { ...missed, limitReason: 'visited-states' }, { ...missed, limitReason: 'shape-universe' }]) {
        const r = await seam.recoverWaste(p, result, 0, { now: () => 0, construct: async () => good });
        assert.equal(r.outcome, 'solved');
        dual(p, r.solutionPath);
    }
    const invalidStep = { operation: 'Half Destroyer', inputs: [{ id: 1, shape: 'Cu------' }], outputs: [], params: {} };
    for (const [q, candidate, reason] of [
        [p, { ...good, depth: 1, solutionPath: [invalidStep] }, 'physics'],
        [p, { ...good, depth: 1, solutionPath: [{ ...invalidStep, inputs: [{ id: 99, shape: 'Cu------' }] }] }, 'input-inventory'],
        [p, { ...good, depth: 1, solutionPath: [{ ...invalidStep, outputs: [{ id: 0, shape: 'Cu------' }] }] }, 'output-id'],
        [p, { ...good, depth: 1 }, 'result-metadata'],
        [{ ...p, enabledOperations: ['Half Destroyer'] }, good, 'missing-half-turn'],
        [p, { ...good, solutionPath: null }, 'construction-failed'],
    ]) {
        const r = await seam.recoverWaste(q, missed, 0, { now: () => 0, construct: async () => candidate });
        for (const k of Object.keys(missed)) assert.deepEqual(r[k], missed[k]);
        assert.equal(r.wasteDisposalAttempt.reason, reason);
    }
});

test('construction, prefix replay, disposal and final replay share the remaining total deadline', async () => {
    const p = atom(['Cu------']), good = { outcome: 'solved', depth: 0, solutionPath: [] };
    let time = 119980;
    const construct = async (_, c) => { assert.equal(c.maxWallMs, 20); return good; };
    const r = await seam.recoverWaste(p, missed, 0, { now: () => time, construct });
    assert.equal(r.outcome, 'solved');
    assert.equal(r.wasteDisposalAttempt.budgetMs, 20);
    const late = await seam.recoverWaste(p, missed, 0, { now: () => time,
        construct: async () => { time += 20; return good; } });
    assert.equal(late.wasteDisposalAttempt.reason, 'budget');
    assert.equal(await seam.recoverWaste(p, missed, 0, { now: () => 120000,
        construct: () => assert.fail('no remaining time') }), missed);
    // Enumerate clock boundaries through all phases; a later expiry must never
    // become an accepted path after the budget has been consumed.
    let rejected = 0, accepted = 0;
    for (let boundary = 3; boundary < 40; boundary++) {
        let reads = 0;
        const r = await seam.recoverWaste(p, missed, 0, {
            now: () => ++reads < boundary ? 119980 : 120000, construct: async () => good });
        if (r.outcome === 'solved') { accepted++; assert.ok(reads <= boundary); }
        else { rejected++; assert.equal(r.wasteDisposalAttempt.reason, 'budget'); }
    }
    assert.ok(rejected >= 10 && accepted > 0);
});
