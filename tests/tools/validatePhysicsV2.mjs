import { verifyRelease } from '../../versions/release1.mjs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { ROOT, json, sha256, verifyVersion } from '../../versions/identity.mjs';
import * as model from '../helpers/independentPhysics.mjs';
import { probe } from '../helpers/physicsProbe.mjs';
import * as prod from '../../shapeOperations.js';
import { replaySolution } from '../helpers/shapeSolverOracle.mjs';
import { replayWitness } from '../../benchmarks/tools/benchmark-core.mjs';

// Historical Physics v2 RC acceptance only. It certifies the Release 1 / v1 pair; it is
// not part of the current maintenance gate (scripts/ci/verify-current.mjs). A tree that is
// not that historical implementation is refused before any evidence directory is created.
const USAGE = 'Usage: node tests/tools/validatePhysicsV2.mjs [evidence-dir] [historical-v1-root]';
if (process.argv[2] === '--help') { console.log(USAGE); process.exit(0); }
let OUT = process.argv[2] ? path.resolve(process.argv[2]) : null;
const historicalRoot = path.resolve(process.argv[3] ?? path.join(os.tmpdir(), 'shapez2-physics-v2-v1'));
function refuse(label, result) {
    const errors = result.errors ?? [];
    console.error(`verify:physics-v2: refusing to run; this is not the historical ${label} identity.`);
    console.error(errors.slice(0, 10).join('\n'));
    if (errors.length > 10) console.error(`... ${errors.length - 10} more error(s)`);
    console.error('No evidence directory was created. The current maintenance gate is scripts/ci/verify-current.mjs.');
    process.exit(1);
}
const identity = await verifyRelease();
if (!identity.valid) refuse('Release 1', identity);
const historicalIdentity = await verifyVersion({ version: 'shape-operations-v1', root: historicalRoot });
if (!historicalIdentity.valid) refuse('v1', historicalIdentity);
if (OUT === null) {
    OUT = await fs.mkdtemp(path.join(os.tmpdir(), 'shapez2-physics-v2-'));
    for (const name of ['input-lateral.json', 'input-propagation-controls.json'])
        await fs.copyFile(path.join(ROOT, 'tests/fixtures/physics-v2', name), path.join(OUT, name));
    console.log(`evidence: ${OUT} (temporary)`);
} else await fs.mkdir(OUT, { recursive: true });
const old = await import(pathToFileURL(path.join(historicalRoot, 'shapeOperations.js')));
const { module: observed } = await probe(ROOT.replaceAll('\\', '/'));
const save = (name, data) => fs.writeFile(path.join(OUT, name), JSON.stringify(data, null, 2) + '\n');
const names = { 'Pin Pusher': 'pushPin', Cutter: 'cut', 'Half Destroyer': 'halfCut', Stacker: 'stack', Swapper: 'swapHalves',
    'Crystal Generator': 'genCrystal', Painter: 'topPaint', 'Rotator CW': 'rotate90CW', 'Rotator CCW': 'rotate90CCW', 'Rotator 180': 'rotate180' };
const call = (mod, op, inputs, params = {}) => mod[names[op]](...inputs.map(c => mod.Shape.fromShapeCode(c)),
    ...(params.color !== undefined ? [params.color] : []), new mod.ShapeOperationConfig(4)).map(s => s.toShapeCode());
const normalize = (a, op) => op === 'Swapper' ? [...a].sort() : a;
const summary = { outputChecks: 0, gravityCalls: 0, supportChecks: 0, allPairsChecks: 0, componentChecks: 0 };
const stages = new Set(); let current;
globalThis.__physicsProbe = (stage, layers, supported) => {
    const rows = layers.map(r => r.map(p => p.shape + p.color)), code = model.encode(rows);
    if (stage === 'first') { current = rows; summary.gravityCalls++; }
    const key = stage + '|' + (stage === 'deleted' ? model.encode(current) + '|' : '') + code;
    if (stages.has(key)) return;
    if (supported) {
        assert.deepEqual(supported, model.supportModel(rows), 'support graph ' + code);
        assert.deepEqual(supported, model.supportClosure(rows), 'all-pairs ' + code);
        summary.supportChecks++; summary.allPairsChecks++;
    } else {
        for (const group of model.components(current)) {
            const removed = group.filter(([l, q]) => rows[l][q][0] !== 'c').length;
            assert.ok(removed === 0 || removed === group.length, 'partial component ' + code);
            summary.componentChecks++;
        }
    }
    stages.add(key);
};
function legalCode(code) {
    const rows = model.decode(code); assert.ok(rows.length >= 1 && rows.length <= 4);
    for (const row of rows) { assert.equal(row.length, 4); for (const p of row) assert.match(p, /^(--|P-|[CRSWHFGcXY][rgbycmwku])$/); }
}
function check(op, inputs, params = {}) {
    const actual = call(prod, op, inputs, params);
    assert.deepEqual(actual, call(observed, op, inputs, params), 'observation parity');
    assert.deepEqual(normalize(actual, op), normalize(model.physicalOutputs(op, inputs, params), op), 'independent physics ' + op);
    summary.outputChecks++; return actual;
}
const operationDifferences = [];
function pathCheck(kind, id, steps) {
    for (const [i, s] of steps.entries()) {
        const inputs = s.inputs.map(x => x.shape), params = s.params ?? {}, actual = check(s.operation, inputs, params);
        inputs.forEach(legalCode); actual.forEach(legalCode);
        assert.deepEqual(normalize(actual.filter(c => !/^[\-:]+$/.test(c)), s.operation),
            normalize(s.outputs.map(x => x.shape), s.operation), `${kind} ${id} step ${i + 1}`);
        const before = call(old, s.operation, inputs, params);
        if (JSON.stringify(actual) !== JSON.stringify(before)) operationDifferences.push({ kind, id, step: i + 1, operation: s.operation, inputs, old: before, new: actual });
    }
}

const catalog = await json(path.join(ROOT, 'benchmarks/input_catalog.json'));
// Every frozen artifact witness, including source/core artifacts outside the final 159.
const inventory = await json(path.join(ROOT, 'versions/frozen-v1.inventory.json'));
const allWitnesses = [], seen = new Set(); let witnessReferences = 0, allWitnessSteps = 0;
for (const file of inventory.files.filter(f => f.path.startsWith('benchmarks/') && f.path.endsWith('.json'))) {
    const doc = await json(path.join(ROOT, file.path));
    const instances = Array.isArray(doc) ? doc : doc.instances;
    for (const instance of instances ?? []) {
        if (!instance.witness?.steps || !instance.target) continue;
        witnessReferences++;
        const key = sha256(JSON.stringify(instance));
        if (seen.has(key)) continue; seen.add(key);
        const replay = replayWitness(instance, catalog);
        assert.equal(replay.valid, true, file.path + ':' + instance.id + ': ' + replay.errors?.join('\n'));
        pathCheck('all-frozen-witnesses', instance.id, replay.trace.steps);
        allWitnessSteps += replay.trace.steps.length;
        allWitnesses.push({ container: file.path, id: instance.id, instanceHash: key, steps: replay.trace.steps.length, resourceReplayValid: true });
    }
}
await save('all-frozen-witnesses.json', { identity, witnessReferences, uniqueInstances: allWitnesses.length, steps: allWitnessSteps, witnesses: allWitnesses });

const controls = await json(path.join(OUT, 'input-lateral.json'));
const propagation = await json(path.join(OUT, 'input-propagation-controls.json'));
const controlDifferences = [];
for (const c of controls.cases) {
    const actual = check(c.operation, c.inputs, c.params);
    assert.deepEqual(call(old, c.operation, c.inputs, c.params), c.actual, 'old control evidence');
    if (JSON.stringify(actual) !== JSON.stringify(c.actual)) controlDifferences.push({ ...c, old: c.actual, new: actual });
}
for (const c of propagation.triggers) check(c.operation, c.inputs, c.params);
for (const c of propagation.rows) {
    const shape = observed.Shape.fromShapeCode(c.input);
    observed._breakCrystals(shape.layers, ...c.seed); assert.equal(shape.toShapeCode(), c.after);
}
assert.equal(controlDifferences.length, 25, 'previously reviewed control changes only');
await save('controls.json', { identity, cases: controls.cases.length, helperControls: propagation.rows.length, triggerControls: propagation.triggers.length, differences: controlDifferences });

globalThis.self = { postMessage() {} };
const { shapeSolver } = await import('../../shapeSolver.js');
const { shapeSolver: oldSolver } = await import(pathToFileURL(path.join(historicalRoot, 'shapeSolver.js')));
const frozen = await json(path.join(ROOT, 'benchmarks/experiments/interior-crystal-column-v1/ICCDCS-A/repeat.json'));
const operations = ['Rotator CW', 'Rotator CCW', 'Rotator 180', 'Half Destroyer', 'Cutter', 'Swapper', 'Stacker', 'Painter', 'Pin Pusher', 'Crystal Generator'];
const directory = path.join(ROOT, 'benchmarks/solver-baselines/hard-53x3-v1/records');
const cases = []; let witnessSteps = 0, frozenSteps = 0, actualSteps = 0;
for (const name of (await fs.readdir(directory)).filter(n => n.endsWith('.json')).sort()) {
    const record = await json(path.join(directory, name));
    const source = await json(path.join(ROOT, record.sourceArtifact));
    const instance = (Array.isArray(source) ? source : source.instances).find(i => i.id === record.instanceId);
    assert.equal(instance.instanceSha256, record.sourceInstanceSha256);
    const caseId = record.targetId + ':' + record.familySlot;
    const p = { targetShapeCodes: [instance.target], startingShapeCodes: instance.availableInputs.flatMap(r => Array(r.count).fill(r.shape)),
        enabledOperations: operations, maxLayers: 4, maxStatesPerLevel: 3000, preventWaste: false, orientationSensitive: false, allowSplitting: false, cleanPainting: true };
    const witness = replayWitness(instance, catalog); assert.equal(witness.valid, true, caseId);
    pathCheck('witness', caseId, witness.trace.steps); witnessSteps += witness.trace.steps.length;
    const historical = frozen.records.find(r => r.targetId + ':' + r.familySlot === caseId).result;
    pathCheck('frozen', caseId, historical.solutionPath); frozenSteps += historical.solutionPath.length;
    const frozenReplay = replaySolution(p, historical.solutionPath, historical); assert.equal(frozenReplay.valid, true, frozenReplay.error);
    const args = [p.targetShapeCodes, p.startingShapeCodes, p.enabledOperations, 4, 3000, false, false, false, true];
    const oldResult = await oldSolver(...args);
    const start = performance.now(), result = await shapeSolver(...args), elapsedMs = performance.now() - start;
    assert.ok(result.solutionPath, caseId + ' unsolved');
    assert.deepEqual(oldResult.solutionPath, historical.solutionPath, 'reproduced v1 path');
    assert.deepEqual(result.solutionPath, historical.solutionPath, 'v2 path changed');
    const replay = replaySolution(p, result.solutionPath, result); assert.equal(replay.valid, true, replay.error);
    pathCheck('actual', caseId, result.solutionPath); actualSteps += result.solutionPath.length;
    cases.push({ caseId, input: p, result, replayValid: true, frozenReplayValid: true, v1Reproduced: true, pathEqual: true, elapsedMs });
    if (cases.length % 30 === 0) console.log(`validated ${cases.length}/159`);
}
delete globalThis.__physicsProbe;
assert.equal(cases.length, 159); assert.equal(operationDifferences.length, 0);
await save('acceptance.json', { semantics: prod.SHAPE_OPERATIONS_SEMANTICS, identity, historicalIdentity,
    summary: { cases: cases.length, solved: cases.length, resourceReplayValid: cases.length, frozenReplayValid: cases.length,
        exactFrozenPaths: cases.length, v1ReproducedPaths: cases.length, witnessSteps, frozenSteps, actualSteps,
        allFrozenWitnessReferences: witnessReferences, allFrozenWitnessInstances: allWitnesses.length, allFrozenWitnessSteps: allWitnessSteps,
        pathDifferences: 0, operationDifferences: operationDifferences.length, ...summary }, operationDifferences, cases });
console.log(JSON.stringify({ cases: cases.length, witnessSteps, frozenSteps, actualSteps, witnessReferences, uniqueWitnessInstances: allWitnesses.length, ...summary }));
