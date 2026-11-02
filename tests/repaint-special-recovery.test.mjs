import assert from 'node:assert/strict';
import test from 'node:test';
globalThis.self = { postMessage() {} };
const { shapeSolver, shapeSolverTestOnly, strictRoutingTestOnly: seam,
    hybridRoutingTestOnly: hybrid } = await import('../shapeSolver.js');
import { replaySolution } from './helpers/shapeSolverOracle.mjs';
import { replay as independentReplay } from '../tools/release1/replay.mjs';

const base = { targetShapeCodes: ['P-----Cu:cr------'], startingShapeCodes: Array(4).fill('CuCuCuCu'),
    enabledOperations: ['Rotator CW', 'Rotator CCW', 'Rotator 180', 'Half Destroyer', 'Cutter',
        'Swapper', 'Stacker', 'Painter', 'Pin Pusher', 'Crystal Generator'],
    maxLayers: 4, maxStatesPerLevel: 3000, preventWaste: false,
    orientationSensitive: false, allowSplitting: false, cleanPainting: false };
const invoke = p => shapeSolver(p.targetShapeCodes, p.startingShapeCodes, p.enabledOperations,
    p.maxLayers, p.maxStatesPerLevel, p.preventWaste, p.orientationSensitive, p.allowSplitting, p.cleanPainting);
const missed = { outcome: 'limit', limitReason: 'generated-states', limitReached: true,
    solutionPath: null, beamPruned: true, depth: 28, statesExplored: 10, generatedStates: 5000000 };
const dualReplay = (p, r) => {
    const production = replaySolution(p, r.solutionPath, r);
    const independent = independentReplay(p, r.solutionPath);
    assert.equal(production.valid, true, production.error);
    assert.equal(independent.valid, true, independent.error);
};

test('public rotatable special misses recover, including actual repainting of colored resources', async () => {
    for (const p of [base, { ...base, targetShapeCodes: ['P-----Sr:cg------'],
        startingShapeCodes: Array(4).fill('SbSbSbSb') }]) {
        const r = await invoke(p);
        assert.equal(r.outcome, 'solved');
        assert.equal(r.solverRoute, 'repaint-special-constructive');
        assert.equal(r.generalSearchAttempt.limitReason, 'generated-states');
        assert.equal(r.generalSearchAttempt.generatedStates, 5000000);
        assert.equal(r.repaintSpecialConstructiveAttempt.accepted, true);
        assert.equal(r.repaintSpecialConstructiveAttempt.budgetMs, 50);
        assert.equal(r.depth, r.solutionPath.length);
        dualReplay(p, r);
        if (p !== base) assert.ok(r.solutionPath.some(s => s.operation === 'Painter'
            && s.inputs.some(i => i.shape.includes('Sb'))));
    }
});

test('existing zero-step, Pin and Crystal public successes retain the entire core result', async () => {
    for (const delta of [
        { startingShapeCodes: base.targetShapeCodes, enabledOperations: [] },
        { targetShapeCodes: ['P-------:Cu------'], startingShapeCodes: ['Cu------'], enabledOperations: ['Pin Pusher'] },
        { targetShapeCodes: ['P-P-----:CuCu----'], startingShapeCodes: ['CuCuCuCu'],
            enabledOperations: ['Half Destroyer', 'Pin Pusher'] },
        { targetShapeCodes: ['CuCucrcr'], startingShapeCodes: ['CuCu----'], enabledOperations: ['Crystal Generator'] },
    ]) {
        const p = { ...base, ...delta }, core = await shapeSolverTestOnly(p);
        assert.equal(core.outcome, 'solved', JSON.stringify(delta));
        assert.deepEqual(await invoke(p), core);
    }
});

test('repaint special recovery has a finite explicit domain and disjoint routing', async () => {
    for (const delta of [{}, { startingShapeCodes: Array(64).fill('Cu------') },
        { targetShapeCodes: ['P-------:Cu------:Cu------:Cu------'] }]) {
        assert.equal(seam.repaintSpecialEligible({ ...base, ...delta }), true);
    }
    const construct = () => assert.fail('excluded domain must not construct');
    for (const delta of [
        { orientationSensitive: true }, { orientationSensitive: null }, { cleanPainting: true },
        { cleanPainting: undefined }, { cleanPainting: null }, { cleanPainting: 0 },
        { preventWaste: true }, { allowSplitting: true }, { maxLayers: 2 },
        { targetShapeCodes: [] }, { targetShapeCodes: ['P-------', 'Cu------'] },
        { targetShapeCodes: ['Cu------'] }, { targetShapeCodes: ['Pr------'] },
        { targetShapeCodes: ['cr----'] }, { startingShapeCodes: ['CuCuCuCuCuCu'] },
        { targetShapeCodes: ['P-------:Cu------:Cu------:Cu------:Cu------'] },
        { startingShapeCodes: Array(65).fill('Cu------') },
    ]) {
        const p = { ...base, ...delta };
        assert.equal(seam.repaintSpecialEligible(p), false);
        assert.equal(await seam.recoverRepaintSpecial(p, missed, 0, { construct }), missed);
    }
    for (const result of [null, { ...missed, outcome: 'solved' }, { ...missed, outcome: 'exhausted' },
        { ...missed, limitReason: 'time' }, { ...missed, limitReason: 'unknown' }]) {
        assert.equal(await seam.recoverRepaintSpecial(base, result, 0, { construct }), result);
    }
});

const atom = { ...base, targetShapeCodes: ['--P-----'], startingShapeCodes: ['P-------'],
    enabledOperations: ['Rotator CW'] };
const step = { operation: 'Rotator CW', inputs: [{ id: 0, shape: 'P-------' }],
    outputs: [{ id: 1, shape: '--P-----' }], params: {} };
const candidate = { outcome: 'solved', depth: 1, solutionPath: [step] };

test('repaint recovery replays original parameters and rejects invalid candidates with the original result intact', async () => {
    for (const result of [{ ...missed, outcome: 'not-found-pruned' }, missed,
        { ...missed, limitReason: 'visited-states' }, { ...missed, limitReason: 'shape-universe' }]) {
        const r = await seam.recoverRepaintSpecial(atom, result, 0,
            { now: () => 0, construct: async (p, config) => {
                assert.equal(p, atom);
                assert.equal(p.orientationSensitive, false);
                assert.equal(config.maxExtractionStates, 6000);
                assert.equal(config.maxMatchingTransitions, 20000);
                assert.equal(config.maxExtractionOperations, 8);
                assert.equal(config.maxOperations, 256);
                return candidate;
            } });
        assert.equal(r.outcome, 'solved');
        dualReplay(atom, r);
    }
    for (const [p, construct, reason] of [
        [atom, async () => ({ ...candidate, solutionPath: [{ ...step, outputs: [] }] }), 'physics'],
        [atom, async () => ({ ...candidate, solutionPath: [] }), 'exact-goal'],
        [atom, async () => ({ ...candidate, solutionPath: [{ ...step, inputs: [{ id: 99, shape: 'P-------' }] }] }), 'input-inventory'],
        [atom, async () => ({ ...candidate, solutionPath: [{ ...step, outputs: [{ id: 0, shape: '--P-----' }] }] }), 'output-id'],
        [atom, async () => ({ ...candidate, solutionPath: [{ ...step, params: { color: 'r' } }] }), 'params'],
        [atom, async () => ({ ...candidate, solutionPath: [{ ...step, operation: 'Splitter' }] }), 'disabled-operation'],
        [{ ...atom, enabledOperations: [] }, async () => candidate, 'disabled-operation'],
        [atom, async () => ({ ...candidate, outcome: 'exhausted' }), 'result-metadata'],
        [atom, async () => ({ ...candidate, depth: 2 }), 'result-metadata'],
        [atom, async () => { throw Error('failure'); }, 'construction-error'],
        [base, async () => ({ solutionPath: null, architectureStatus: 'resource-mismatch' }), 'construction-failed'],
    ]) {
        const r = await seam.recoverRepaintSpecial(p, missed, 0, { now: () => 0, construct });
        for (const key of Object.keys(missed)) assert.deepEqual(r[key], missed[key]);
        assert.equal(r.repaintSpecialConstructiveAttempt.reason, reason);
        assert.equal(r.solverRoute, 'general-search');
    }
});

test('actual constructor rejects missing operations and insufficient finite resources', async () => {
    for (const delta of [{ startingShapeCodes: [] }, { startingShapeCodes: ['Cu------'] },
        ...['Cutter', 'Swapper', 'Stacker', 'Pin Pusher', 'Crystal Generator'].map(op =>
            ({ enabledOperations: base.enabledOperations.filter(value => value !== op) })),
        { targetShapeCodes: ['P-----Sr:cg------'], startingShapeCodes: Array(4).fill('SbSbSbSb'),
            enabledOperations: base.enabledOperations.filter(op => op !== 'Painter') }]) {
        const r = await seam.recoverRepaintSpecial({ ...base, ...delta }, missed, performance.now());
        assert.equal(r.outcome, 'limit');
        assert.equal(r.solutionPath, null);
        assert.equal(r.repaintSpecialConstructiveAttempt.fallback, true);
    }
});

test('hybrid replay implements both painting modes without accepting a merely rotated exact candidate', () => {
    const p = { ...base, targetShapeCodes: ['Sr------'], startingShapeCodes: ['Sb------'], enabledOperations: ['Painter'] };
    const path = [{ operation: 'Painter', inputs: [{ id: 0, shape: 'Sb------' }],
        outputs: [{ id: 1, shape: 'Sr------' }], params: { color: 'r' } }];
    assert.equal(hybrid.validate(p, path).valid, true);
    assert.equal(hybrid.validate({ ...p, cleanPainting: true }, path).reason, 'clean-painting');
    for (const cleanPainting of [null, undefined, 0]) {
        assert.equal(hybrid.validate({ ...p, cleanPainting }, path).reason, 'unsupported-plan');
    }
    assert.equal(hybrid.validate({ ...atom, targetShapeCodes: ['----P---'] }, [step]).reason, 'exact-goal');
});

test('bounded repaint recovery enforces 256 operations and remaining deadline, including acceptance replay', async () => {
    const codes = ['P-------', '--P-----', '----P---', '------P-'];
    const path = Array.from({ length: 256 }, (_, i) => ({ operation: 'Rotator CW',
        inputs: [{ id: i, shape: codes[i % 4] }], outputs: [{ id: i + 1, shape: codes[(i + 1) % 4] }], params: {} }));
    const p = { ...atom, targetShapeCodes: ['P-------'] };
    const boundary = await seam.recoverRepaintSpecial(p, missed, 0,
        { now: () => 0, construct: async () => ({ outcome: 'solved', depth: 256, solutionPath: path }) });
    assert.equal(boundary.outcome, 'solved'); dualReplay(p, boundary);
    const over = await seam.recoverRepaintSpecial(p, missed, 0, { now: () => 0,
        construct: async () => ({ outcome: 'solved', depth: 257, solutionPath: [...path, step] }) });
    assert.equal(over.repaintSpecialConstructiveAttempt.reason, 'unsupported-plan');
    let time = 119980;
    const recovered = await seam.recoverRepaintSpecial(atom, missed, 0, { now: () => time,
        construct: async (_, config) => { assert.equal(config.maxWallMs, 20); return candidate; } });
    assert.equal(recovered.outcome, 'solved');
    assert.equal(recovered.repaintSpecialConstructiveAttempt.budgetMs, 20);
    const late = await seam.recoverRepaintSpecial(atom, missed, 0, { now: () => time,
        construct: async () => { time += 20; return candidate; } });
    assert.equal(late.repaintSpecialConstructiveAttempt.reason, 'budget');
    assert.equal(await seam.recoverRepaintSpecial(atom, missed, 0, { now: () => 120000,
        construct: () => assert.fail('deadline exhausted') }), missed);
    let reads = 0;
    const replayLate = await seam.recoverRepaintSpecial(atom, missed, 0, {
        now: () => ++reads < 5 ? 119980 : 120000, construct: async () => candidate });
    assert.equal(replayLate.outcome, 'limit');
    assert.equal(replayLate.repaintSpecialConstructiveAttempt.reason, 'budget');
});
