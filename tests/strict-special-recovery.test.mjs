import assert from 'node:assert/strict';
import test from 'node:test';
globalThis.self = { postMessage() {} };
const { shapeSolver, shapeSolverTestOnly, strictRoutingTestOnly: seam } = await import('../shapeSolver.js');
import { replaySolution } from './helpers/shapeSolverOracle.mjs';
import { replay as independentReplay } from '../tools/release1/replay.mjs';

const base = { targetShapeCodes: ['P-----Cu:cr------'], startingShapeCodes: Array(4).fill('CuCuCuCu'),
    enabledOperations: ['Rotator CW', 'Rotator CCW', 'Rotator 180', 'Cutter', 'Swapper',
        'Stacker', 'Pin Pusher', 'Crystal Generator'],
    maxLayers: 4, maxStatesPerLevel: 3000, preventWaste: false,
    orientationSensitive: true, allowSplitting: false, cleanPainting: true };
const invoke = p => shapeSolver(p.targetShapeCodes, p.startingShapeCodes, p.enabledOperations,
    p.maxLayers, p.maxStatesPerLevel, p.preventWaste, p.orientationSensitive, p.allowSplitting, p.cleanPainting);
const missed = { outcome: 'limit', limitReached: true, limitReason: 'generated-states',
    solutionPath: null, beamPruned: true, depth: 28, statesExplored: 10, generatedStates: 5000000 };

test('public strict mixed-material state-limit miss recovers with exact finite-token dual replay', async () => {
    const result = await invoke(base);
    assert.equal(result.outcome, 'solved');
    assert.equal(result.solverRoute, 'strict-special-constructive');
    assert.equal(result.generalSearchAttempt.outcome, 'limit');
    assert.equal(result.generalSearchAttempt.limitReason, 'generated-states');
    assert.equal(result.generalSearchAttempt.generatedStates, 5000000);
    assert.equal(result.strictConstructiveAttempt.accepted, true);
    assert.equal(result.strictConstructiveAttempt.budgetMs, 50);
    assert.equal(result.depth, result.solutionPath.length);
    assert.equal(replaySolution(base, result.solutionPath, result).valid, true);
    const independent = independentReplay(base, result.solutionPath);
    assert.equal(independent.valid, true, independent.error);
    assert.ok(result.searchWallMs >= result.generalSearchAttempt.elapsedMs + result.strictConstructiveAttempt.elapsedMs);
});

test('existing zero-step and short special-material successes preserve the complete core result', async () => {
    for (const cleanPainting of [true, false]) for (const delta of [
        { targetShapeCodes: ['P-----Cu:cr------'], startingShapeCodes: ['P-----Cu:cr------'], enabledOperations: [] },
        { targetShapeCodes: ['P-------:Cu------'], startingShapeCodes: ['Cu------'], enabledOperations: ['Pin Pusher'] },
        { targetShapeCodes: ['P-P-----:CuCu----'], startingShapeCodes: ['CuCuCuCu'],
            enabledOperations: ['Half Destroyer', 'Pin Pusher'] },
    ]) {
        const p = { ...base, ...delta, cleanPainting };
        const core = await shapeSolverTestOnly(p);
        assert.equal(core.outcome, 'solved');
        assert.deepEqual(await invoke(p), core);
    }
});

test('special recovery has an explicit bounded domain and never repeats ordinary recovery', async () => {
    assert.equal(seam.strictSpecialEligible(base), true);
    assert.equal(seam.strictSpecialEligible({ ...base, cleanPainting: false }), true);
    assert.equal(seam.strictSpecialEligible({ ...base, startingShapeCodes: Array(64).fill('Cu------') }), true);
    const construct = () => assert.fail('excluded recovery must not construct');
    for (const delta of [
        { targetShapeCodes: ['CcCcCcCc'] }, { targetShapeCodes: ['Cu------'], startingShapeCodes: ['cr------'] },
        { targetShapeCodes: ['P-------', 'Cu------'] }, { maxLayers: 2 }, { preventWaste: true },
        { orientationSensitive: false }, { allowSplitting: true }, { cleanPainting: null },
        { cleanPainting: undefined }, { startingShapeCodes: Array(65).fill('Cu------') },
        { targetShapeCodes: ['Pr------'] }, { targetShapeCodes: ['cr----'] },
        { startingShapeCodes: ['CuCuCuCuCuCu'] }, { targetShapeCodes: ['P-------:Cu------:Cu------:Cu------:Cu------'] },
    ]) {
        const p = { ...base, ...delta };
        assert.equal(seam.strictSpecialEligible(p), false);
        assert.equal(await seam.recoverStrictSpecial(p, missed, 0, { construct }), missed);
    }
    for (const result of [null, { ...missed, outcome: 'solved' }, { ...missed, outcome: 'exhausted' },
        { ...missed, limitReason: 'time' }, { ...missed, limitReason: 'unknown' }]) {
        assert.equal(await seam.recoverStrictSpecial(base, result, 0, { construct }), result);
    }
});

const atom = { ...base, targetShapeCodes: ['--P-----'], startingShapeCodes: ['P-------'],
    enabledOperations: ['Rotator CW'] };
const step = { operation: 'Rotator CW', inputs: [{ id: 0, shape: 'P-------' }],
    outputs: [{ id: 1, shape: '--P-----' }], params: {} };
const candidate = { outcome: 'solved', depth: 1, solutionPath: [step] };

test('special recovery accepts pruning and only known non-time safety limits; rejected plans retain the baseline', async () => {
    for (const result of [{ ...missed, outcome: 'not-found-pruned' }, missed,
        { ...missed, limitReason: 'visited-states' }, { ...missed, limitReason: 'shape-universe' }]) {
        const recovered = await seam.recoverStrictSpecial(atom, result, 0, {
            now: () => 0, construct: async () => candidate });
        assert.equal(recovered.outcome, 'solved');
        assert.equal(recovered.generalSearchAttempt.outcome, result.outcome);
        assert.equal(recovered.generalSearchAttempt.limitReason, result.limitReason);
    }
    for (const [p, construct, reason] of [
        [atom, async () => ({ ...candidate, solutionPath: [{ ...step, outputs: [] }] }), 'physics'],
        [atom, async () => ({ ...candidate, solutionPath: [] }), 'exact-goal'],
        [atom, async () => ({ ...candidate, solutionPath: [{ ...step, inputs: [{ id: 99, shape: 'P-------' }] }] }), 'input-inventory'],
        [{ ...atom, enabledOperations: [] }, async () => candidate, 'disabled-operation'],
        [atom, async () => { throw Error('failure'); }, 'construction-error'],
        [base, async () => ({ solutionPath: null, architectureStatus: 'resource-mismatch' }), 'construction-failed'],
    ]) {
        const result = await seam.recoverStrictSpecial(p, missed, 0, { now: () => 0, construct });
        for (const key of Object.keys(missed)) assert.deepEqual(result[key], missed[key]);
        assert.equal(result.strictConstructiveAttempt.reason, reason);
        assert.equal(result.solverRoute, 'general-search');
    }
});

test('special recovery charges construction and replay to the remaining total deadline', async () => {
    let time = 119980;
    const recovered = await seam.recoverStrictSpecial(atom, missed, 0, { now: () => time,
        construct: async (_, config) => { assert.equal(config.maxWallMs, 20); return candidate; } });
    assert.equal(recovered.outcome, 'solved');
    assert.equal(recovered.strictConstructiveAttempt.budgetMs, 20);
    const late = await seam.recoverStrictSpecial(atom, missed, 0, { now: () => time,
        construct: async () => { time += 20; return candidate; } });
    assert.equal(late.outcome, 'limit');
    assert.equal(late.strictConstructiveAttempt.reason, 'budget');
    assert.equal(await seam.recoverStrictSpecial(atom, missed, 0, { now: () => 120000,
        construct: () => assert.fail('deadline exhausted') }), missed);
    let reads = 0;
    const replayLate = await seam.recoverStrictSpecial(atom, missed, 0, {
        now: () => ++reads < 5 ? 119980 : 120000, construct: async () => candidate });
    assert.equal(replayLate.outcome, 'limit');
    assert.equal(replayLate.strictConstructiveAttempt.reason, 'budget');
});
