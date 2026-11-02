import assert from 'node:assert/strict';
import test from 'node:test';
import { Shape, rotate90CW, rotate90CCW, rotate180 } from '../shapeOperations.js';
import { planMixedPinCrystalSubassembly } from '../constructive/mixed-pin-crystal-construction-planner.js';
import { interiorCrystalColumnSolve } from '../interiorCrystalColumnSolver.js';
import { mixedPinCrystalGoalDecomposedSolve } from '../mixedPinCrystalGoalDecomposedSolver.js';
import { physicalOutputs } from './helpers/independentPhysics.mjs';
import { replaySolution } from './helpers/shapeSolverOracle.mjs';
import { replay as independentReplay } from '../tools/release1/replay.mjs';

globalThis.self = { postMessage() {} };
const { shapeSolver, shapeSolverTestOnly, strictRoutingTestOnly: seam } = await import('../shapeSolver.js');
const base = { targetShapeCodes: ['RuP-----:--cb----'], startingShapeCodes: Array(4).fill('RuRuRuRu'),
    enabledOperations: ['Rotator CW', 'Rotator CCW', 'Rotator 180', 'Half Destroyer', 'Cutter',
        'Swapper', 'Stacker', 'Painter', 'Pin Pusher', 'Crystal Generator'],
    maxLayers: 4, maxStatesPerLevel: 3000, preventWaste: false,
    orientationSensitive: true, allowSplitting: false, cleanPainting: true };
const config = { id: 'rotation-regression', maxExtractionOperations: 8, maxExtractionStates: 6000,
    maxMatchingTransitions: 20000, maxOperations: 256, maxWallMs: 50 };
const missed = { outcome: 'limit', solutionPath: null, depth: 34, beamPruned: true,
    statesExplored: 93428, generatedStates: 5000000, limitReached: true, limitReason: 'generated-states' };
const invoke = p => shapeSolver(p.targetShapeCodes, p.startingShapeCodes, p.enabledOperations,
    p.maxLayers, p.maxStatesPerLevel, p.preventWaste, p.orientationSensitive, p.allowSplitting, p.cleanPainting);

function accept(p, result) {
    assert.equal(result.outcome, 'solved', result.constructionError);
    assert.equal(result.depth, result.solutionPath.length);
    assert.equal(seam.validate(p, result.solutionPath).valid, true);
    const production = replaySolution(p, result.solutionPath, result);
    assert.equal(production.valid, true, production.error);
    const independent = independentReplay(p, result.solutionPath);
    assert.equal(independent.valid, true, independent.error);
    return independent;
}

test('public strict seam targets recover from the real generated-state limit using physical inverse rotation', async () => {
    for (const p of [base, { ...base, targetShapeCodes: ['SuP-----:--cg----'],
        startingShapeCodes: Array(4).fill('SuSuSuSu') }]) {
        const r = await invoke(p);
        accept(p, r);
        assert.equal(r.solverRoute, 'strict-special-constructive');
        assert.equal(r.generalSearchAttempt.limitReason, 'generated-states');
        assert.equal(r.generalSearchAttempt.generatedStates, 5000000);
        assert.equal(r.strictConstructiveAttempt.accepted, true);
        assert.equal(r.strictConstructiveAttempt.budgetMs, 50);
        assert.equal(r.depth, 27);
        assert.equal(r.solutionPath.at(-1).operation, 'Rotator CCW');
    }
});

test('mixed decomposition chooses nonempty prerequisites in all four orientations and at the layer boundary', async () => {
    for (const height of [2, 4]) {
        let shape = Shape.fromShapeCode(height === 2 ? base.targetShapeCodes[0]
            : 'RuP-----:--cb----:--cb----:--cb----');
        for (let turns = 0; turns < 4; turns++) {
            const p = { ...base, targetShapeCodes: [shape.toShapeCode()],
                startingShapeCodes: Array(height === 2 ? 4 : 12).fill('RuRuRuRu') };
            const plan = planMixedPinCrystalSubassembly(p.targetShapeCodes[0]);
            assert.equal(Shape.fromShapeCode(plan.prerequisite.left.target).isEmpty(), false);
            assert.equal(Shape.fromShapeCode(plan.prerequisite.right.target).isEmpty(), false);
            assert.equal(plan.rotationTurns, turns % 2 === 0 ? 1 : 0);
            const r = await interiorCrystalColumnSolve(p, config);
            const replay = accept(p, r);
            assert.equal(r.depth, (height === 2 ? [27, 26, 26, 25] : [57, 56, 56, 55])[turns]);
            if (plan.rotationTurns) {
                const last = r.solutionPath.at(-1), before = replay.trace.at(-2).inventory;
                assert.equal(last.operation, 'Rotator CCW');
                assert.ok(before.some(x => x.id === last.inputs[0].id && x.shape === last.inputs[0].shape));
                // Only the selected goal token changes; all Cutter/Swapper byproducts survive.
                const rest = before.filter(x => x.id !== last.inputs[0].id).map(x => [x.id, x.shape]);
                assert.deepEqual(replay.terminal.filter(([id]) => id !== last.outputs[0].id), rest);
                assert.equal(seam.validate(p, r.solutionPath.slice(0, -1)).reason, 'exact-goal');
            }
            shape = rotate90CW(shape)[0];
        }
    }
});

test('Rotators preserve Pin, fused Crystal, layer order and empty cells without applying gravity', () => {
    for (const code of [base.targetShapeCodes[0], 'crcr--cr:P-P-P-P-:--cbcb--:----Ru--',
        'P-------:--cr----', '--------:cr------']) {
        const original = Shape.fromShapeCode(code);
        for (const [name, fn] of [['Rotator CW', rotate90CW], ['Rotator CCW', rotate90CCW], ['Rotator 180', rotate180]]) {
            const output = fn(original)[0].toShapeCode();
            assert.deepEqual([output], physicalOutputs(name, [code]));
            assert.equal(output.split(':').length, code.split(':').length);
            assert.deepEqual(output.split(':').map(l => l.match(/../g).sort()), code.split(':').map(l => l.match(/../g).sort()));
        }
        assert.equal(rotate90CCW(rotate90CW(original)[0])[0].toShapeCode(), code);
        assert.equal(rotate180(rotate180(original)[0])[0].toShapeCode(), code);
    }
});

test('missing real operations, finite resource shortage and unsupported topology retain the search failure', async () => {
    for (const operation of ['Rotator CW', 'Rotator CCW', 'Crystal Generator', 'Pin Pusher', 'Swapper', 'Stacker']) {
        const p = { ...base, enabledOperations: base.enabledOperations.filter(o => o !== operation) };
        const r = await seam.recoverStrictSpecial(p, missed, 0, { now: () => 0 });
        for (const key of Object.keys(missed)) assert.deepEqual(r[key], missed[key]);
        assert.equal(r.strictConstructiveAttempt.accepted, false);
        assert.equal(r.strictConstructiveAttempt.reason, 'construction-failed');
    }
    for (const delta of [
        { startingShapeCodes: [] },
        { enabledOperations: base.enabledOperations.filter(o => !o.startsWith('Rotator')) },
        { enabledOperations: ['Rotator 180'] },
        { targetShapeCodes: ['P-------:--cr----'] },
    ]) {
        const r = await seam.recoverStrictSpecial({ ...base, ...delta }, missed, 0, { now: () => 0 });
        for (const key of Object.keys(missed)) assert.deepEqual(r[key], missed[key]);
        assert.equal(r.strictConstructiveAttempt.accepted, false);
    }
    // The inverse rotation is a necessary operation, not an encoded goal alias.
    const r = await interiorCrystalColumnSolve(base, config);
    assert.equal(seam.validate({ ...base, enabledOperations: base.enabledOperations.filter(o => o !== 'Rotator CCW') },
        r.solutionPath).reason, 'disabled-operation');
    assert.equal(seam.validate(base, [...r.solutionPath.slice(0, -1), {
        ...r.solutionPath.at(-1), inputs: [{ ...r.solutionPath.at(-1).inputs[0], id: 0 }],
    }]).reason, 'input-inventory');
    // Outer shared-occurrence construction can use multiple outputs from ONE
    // original full shape. Inner per-atom matching is not a resource lower bound.
    const shared = { ...base, startingShapeCodes: ['RuRuRuRu'] };
    const recovered = await seam.recoverStrictSpecial(shared, missed, 0, { now: () => 0 });
    accept(shared, recovered);
});

test('one constructor call shares the original deadline and work caps, including inverse operations', async () => {
    const candidate = await interiorCrystalColumnSolve(base, config);
    let calls = 0;
    const r = await seam.recoverStrictSpecial(base, missed, 0, { now: () => 119980,
        construct: async (p, limits) => {
            calls++;
            assert.deepEqual(limits, { ...config, id: 'strict-ordinary-v1', maxWallMs: 20 });
            assert.deepEqual(p, base);
            return candidate;
        } });
    assert.equal(calls, 1);
    accept(base, r);
    assert.equal(r.strictConstructiveAttempt.budgetMs, 20);
    assert.equal(await seam.recoverStrictSpecial(base, missed, 0, { now: () => 120000,
        construct: () => assert.fail('total deadline exhausted') }), missed);
    let time = 119980;
    const late = await seam.recoverStrictSpecial(base, missed, 0, { now: () => time,
        construct: async () => { time += 20; return candidate; } });
    assert.equal(late.outcome, missed.outcome);
    assert.equal(late.strictConstructiveAttempt.reason, 'budget');
    const limited = await mixedPinCrystalGoalDecomposedSolve(base, { ...config, maxOperations: 26 });
    assert.equal(limited.solutionPath, null);
    assert.equal(limited.limitReason, 'operations');
    assert.equal(limited.depth, 27);
    assert.equal(await seam.recoverStrictSpecial({ ...base, preventWaste: true }, missed, 0,
        { construct: () => assert.fail('waste prevention excluded') }), missed);
});

test('existing single-column, short Pin and assembled strict goals retain the complete core result', async () => {
    for (const p of [
        { ...base, startingShapeCodes: [base.targetShapeCodes[0]], enabledOperations: [] },
        { ...base, targetShapeCodes: ['P-------:cr------'], startingShapeCodes: ['cr------'], enabledOperations: ['Pin Pusher'] },
        { ...base, targetShapeCodes: ['P-P-----:RuRu----'], startingShapeCodes: ['RuRuRuRu'], enabledOperations: ['Half Destroyer', 'Pin Pusher'] },
    ]) {
        const core = await shapeSolverTestOnly(p);
        assert.equal(core.outcome, 'solved');
        assert.deepEqual(await invoke(p), core);
    }
});
