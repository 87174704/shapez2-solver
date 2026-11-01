import test from 'node:test';
import assert from 'node:assert/strict';
import { replaySolution } from './helpers/shapeSolverOracle.mjs';
import { replay as independentReplay } from '../tools/release1/replay.mjs';

globalThis.self = { postMessage() {} };
const { shapeSolver, shapeSolverTestOnly, strictRoutingTestOnly: seam } = await import('../shapeSolver.js');
const invoke = p => shapeSolver(p.targetShapeCodes, p.startingShapeCodes, p.enabledOperations,
    p.maxLayers, p.maxStatesPerLevel, p.preventWaste, p.orientationSensitive, p.allowSplitting, p.cleanPainting);
const base = {
    targetShapeCodes: ['WuCuRuSu'],
    startingShapeCodes: ['CuCuCuCu', 'RuRuRuRu', 'SuSuSuSu', 'WuWuWuWu'],
    enabledOperations: ['Rotator CW', 'Rotator CCW', 'Rotator 180', 'Half Destroyer', 'Cutter', 'Stacker'],
    maxLayers: 4, maxStatesPerLevel: 100, preventWaste: false,
    orientationSensitive: true, allowSplitting: false, cleanPainting: false,
};
const missed = { outcome: 'not-found-pruned', solutionPath: null, beamPruned: true,
    depth: 3, statesExplored: 5, generatedStates: 10 };

test('public recovery solves ordinary beam misses, including shared finite resources and repainting', async t => {
    const cases = [
        base,
        { ...base, targetShapeCodes: ['CuRu----:Cu----Wu:Wu----Su:----RuSu'],
            startingShapeCodes: ['CuRuSuWu', 'WuCuRuSu'], enabledOperations: [...base.enabledOperations, 'Swapper'] },
        { ...base, targetShapeCodes: ['CrCrRgRg:RgRgSmSm:SmSmCrCr'],
            startingShapeCodes: ['CbCbCbCb', 'RbRbRbRb', 'SbSbSbSb'],
            enabledOperations: [...base.enabledOperations, 'Painter'] },
    ];
    for (const p of cases) await t.test(p.targetShapeCodes[0], async () => {
        const core = await shapeSolverTestOnly(p);
        assert.equal(core.outcome, 'not-found-pruned');
        const r = await invoke(p);
        assert.equal(r.outcome, 'solved');
        assert.equal(r.solverRoute, 'strict-ordinary-constructive');
        assert.equal(r.strictConstructiveAttempt.accepted, true);
        assert.equal(r.strictConstructiveAttempt.budgetMs, 50);
        assert.equal(r.generalSearchAttempt.outcome, core.outcome);
        assert.equal(r.generalSearchAttempt.statesExplored, core.statesExplored);
        assert.equal(r.generalSearchAttempt.generatedStates, core.generatedStates);
        assert.equal(r.depth, r.solutionPath.length);
        assert.equal(replaySolution(p, r.solutionPath, r).valid, true);
        const independent = independentReplay(p, r.solutionPath);
        assert.equal(independent.valid, true, independent.error);
        assert.ok(r.searchWallMs >= r.generalSearchAttempt.elapsedMs + r.strictConstructiveAttempt.elapsedMs);
        if (p.enabledOperations.includes('Painter')) assert.ok(r.solutionPath.some(s => s.operation === 'Painter'));
    });
});

test('unrestricted successful search preserves zero-step, short-path and repaint results exactly', async () => {
    for (const p of [
        { ...base, targetShapeCodes: [base.startingShapeCodes[0]] },
        { ...base, targetShapeCodes: ['CuCuRuRu'], enabledOperations: [...base.enabledOperations, 'Swapper'] },
        { ...base, targetShapeCodes: ['Cr------'], startingShapeCodes: ['Cb------'], enabledOperations: ['Painter'] },
    ]) {
        const core = await shapeSolverTestOnly(p);
        assert.equal(core.outcome, 'solved');
        assert.deepEqual(await invoke(p), core);
    }
});

test('failed real recovery retains beam-pruned classification and counters', async () => {
    const p = { ...base, targetShapeCodes: ['HuHuHuHu'], startingShapeCodes: ['CuRuSuWu', 'RuSuWuCu'],
        enabledOperations: ['Rotator CW'], maxStatesPerLevel: 1 };
    const core = await shapeSolverTestOnly(p), r = await invoke(p);
    for (const key of Object.keys(core)) assert.deepEqual(r[key], core[key]);
    assert.equal(r.solverRoute, 'general-search');
    assert.equal(r.strictConstructiveAttempt.fallback, true);
    assert.equal(r.strictConstructiveAttempt.reason, 'construction-failed');
});

test('recovery domain excludes other outcomes, painting modes, special parts and unsupported parameters', async () => {
    const construct = () => { throw Error('must not construct'); };
    assert.equal(await seam.recoverPrunedOrdinary(base, null, 0, { construct }), null, 'cancelled search');
    assert.equal(seam.strictOrdinaryEligible(base), true);
    for (const delta of [{ cleanPainting: true }, { cleanPainting: undefined }, { cleanPainting: null },
        { maxLayers: 2 }, { orientationSensitive: false }, { allowSplitting: true }, { preventWaste: true },
        { targetShapeCodes: ['P-------'] }, { startingShapeCodes: ['cr------'] },
        { startingShapeCodes: Array(65).fill('Cu------') }, { targetShapeCodes: ['Cu------', 'Ru------'] }]) {
        assert.equal(await seam.recoverPrunedOrdinary({ ...base, ...delta }, missed, 0, { construct }), missed);
    }
    for (const outcome of ['solved', 'exhausted', 'limit']) {
        const r = { ...missed, outcome };
        assert.equal(await seam.recoverPrunedOrdinary(base, r, 0, { construct }), r);
    }
});

const atom = { ...base, targetShapeCodes: ['--Ru----'], startingShapeCodes: ['Ru------'],
    enabledOperations: ['Rotator CW'] };
const step = { operation: 'Rotator CW', inputs: [{ id: 0, shape: 'Ru------' }],
    outputs: [{ id: 1, shape: '--Ru----' }], params: {} };
const candidate = { outcome: 'solved', depth: 1, solutionPath: [step] };

test('recovery rejects invalid or disabled candidates through the unchanged replay gate', async () => {
    for (const [p, construct, reason] of [
        [atom, async () => ({ ...candidate, solutionPath: [{ ...step, inputs: [{ id: 9, shape: 'Ru------' }] }] }), 'input-inventory'],
        [{ ...atom, enabledOperations: [] }, async () => candidate, 'disabled-operation'],
        [atom, async () => { throw Error('failure'); }, 'construction-error'],
    ]) {
        const r = await seam.recoverPrunedOrdinary(p, missed, 0, { construct, now: () => 0 });
        assert.equal(r.outcome, missed.outcome);
        assert.equal(r.solutionPath, null);
        assert.equal(r.strictConstructiveAttempt.reason, reason);
        assert.equal(r.strictConstructiveAttempt.fallback, true);
    }
});

test('recovery shares the total deadline and charges both construction and replay', async () => {
    let time = 119980;
    const construct = async (_, config) => { assert.equal(config.maxWallMs, 20); return candidate; };
    const r = await seam.recoverPrunedOrdinary(atom, missed, 0, { now: () => time, construct });
    assert.equal(r.outcome, 'solved');
    assert.equal(r.strictConstructiveAttempt.budgetMs, 20);
    const late = await seam.recoverPrunedOrdinary(atom, missed, 0, { now: () => time,
        construct: async (_, config) => { assert.equal(config.maxWallMs, 20); time += 20; return candidate; } });
    assert.equal(late.outcome, 'not-found-pruned');
    assert.equal(late.strictConstructiveAttempt.reason, 'budget');
    assert.equal(await seam.recoverPrunedOrdinary(atom, missed, 0,
        { now: () => 120000, construct: () => assert.fail('deadline exhausted') }), missed);
    let reads = 0;
    const replayLate = await seam.recoverPrunedOrdinary(atom, missed, 0, {
        now: () => ++reads < 5 ? 119980 : 120000, construct });
    assert.equal(replayLate.outcome, 'not-found-pruned');
    assert.equal(replayLate.strictConstructiveAttempt.reason, 'budget');
});
