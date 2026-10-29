import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyVersion } from '../../versions/identity.mjs';
const root = import.meta.dirname, repo = path.resolve(root, '../..');
const hash = b => createHash('sha256').update(b).digest('hex');
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const before = read('source-before.json'), version = 'shape-operations-v2-support-closure';
const baseline = await verifyVersion({ version, root: 'E:/solver' });
assert.equal(baseline.valid, true, baseline.errors.join('\n'));
const candidate = await verifyVersion({ version, root: repo });
assert.deepEqual(candidate.errors, ['runtime: shapeSolver.js hash differs']);
assert.equal(candidate.frozenFilesChecked, 461);
const originalChanges = [], patchChanges = [], cloneEol = [];
for (const [p, expected] of Object.entries(before.original)) {
    if (hash(fs.readFileSync(path.join('E:/solver', p))) !== expected) originalChanges.push(p);
    const current = fs.readFileSync(path.join(repo, p));
    if (hash(current) !== expected) {
        const old = fs.readFileSync(path.join('E:/solver', p));
        if (current.toString().replaceAll('\r\n', '\n') === old.toString().replaceAll('\r\n', '\n')) cloneEol.push(p);
        else patchChanges.push(p);
    }
}
assert.deepEqual(originalChanges, []);
assert.deepEqual(patchChanges, ['shapeSolver.js']);
for (const [p, expected] of Object.entries(before.mandatoryReports)) {
    assert.equal(hash(fs.readFileSync('E:/solver-ordinary-rca-20261030/' + p)), expected);
}
// Changes to a constructor, physics, cache or generic search body are forbidden.
const oldSolver = fs.readFileSync('E:/solver/shapeSolver.js', 'utf8');
const newSolver = fs.readFileSync(path.join(repo, 'shapeSolver.js'), 'utf8');
const core = text => text.slice(text.indexOf('async function shapeSolverCore('), text.indexOf('const strictRoutingTestOnly') > 0
    ? text.indexOf('const strictRoutingTestOnly') : text.indexOf('export { BoundedStateCollector'));
assert.equal(core(newSolver).trim(), core(oldSolver).trim());
const cacheAndBeam = text => text.slice(text.indexOf('const operations ='), text.indexOf('let cancelled ='));
assert.equal(cacheAndBeam(newSolver), cacheAndBeam(oldSolver));
const legacyDispatch = text => text.slice(text.indexOf('    const constructiveEligible ='),
    text.indexOf('// This named seam is intentionally test-only.'));
assert.equal(legacyDispatch(newSolver), legacyDispatch(oldSolver));
const files = ['shapeSolver.js', 'constructive/validate-strict-plan.js', 'shapeOperations.js', 'shapeConstants.js'];
const source = Object.fromEntries(files.map(p => [p, hash(fs.readFileSync(path.join(repo, p)))]));
const identity = { rc: before.rc, baseline, candidate, candidateIsHistoricalRC: false,
    explanation: 'Expected runtime identity divergence is exactly shapeSolver.js; historical pins are untouched. New validator is separately hashed.',
    originalChanges, patchChanges, cloneEol, source, coreAndExplorerUnchanged: true, cacheAndBeamUnchanged: true,
    newProductionFiles: ['constructive/validate-strict-plan.js'], recordedAt: new Date().toISOString() };
fs.writeFileSync(path.join(root, 'identity-validation.json'), JSON.stringify(identity, null, 2) + '\n');
console.log(JSON.stringify(identity, null, 2));
