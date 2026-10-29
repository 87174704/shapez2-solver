import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { replay } from './independent-replay.mjs';
import { replaySolution } from '../../tests/helpers/shapeSolverOracle.mjs';
const root = import.meta.dirname;
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const hash = x => createHash('sha256').update(x).digest('hex');
const cases = read('measured-cases.json'), lock = read('input-lock.json');
assert.equal(hash(fs.readFileSync(path.join(root, 'measured-cases.json'))), lock.sha256);
const rows = fs.readFileSync(path.join(root, 'formal.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
assert.equal(rows.length, cases.length * 9);
const frozenPlans = JSON.parse(fs.readFileSync(new URL('../../benchmarks/experiments/interior-crystal-column-v1/ICCDCS-A/repeat.json', import.meta.url), 'utf8'));
const expected = new Map(frozenPlans.records.map(r => [r.targetId + '-' + r.familySlot, r.result.solutionPath]));
const ledger = [], failures = [];
for (const row of rows) {
    const c = cases.find(c => c.id === row.caseId), raw = read(row.evidence);
    assert.equal(hash(JSON.stringify(c.input)), row.inputHash);
    assert.equal(raw.inputHash, row.inputHash);
    const item = { caseId: c.id, variant: row.algorithm, repeat: row.repeat, status: row.status, evidence: row.evidence };
    if (row.status === 'SOLVED') {
        const a = replaySolution(c.input, raw.result.solutionPath, raw.result), b = replay(c.input, raw.result.solutionPath);
        item.oracleValid = a.valid; item.independentValid = b.valid;
        item.error = a.error ?? b.error ?? null;
        assert.equal(hash(JSON.stringify(raw.result.solutionPath)), row.pathHash);
        if (!a.valid || !b.valid) failures.push(item);
        if (c.expectation === 'unreachable') failures.push({ ...item, error: 'prespecified negative unexpectedly solved' });
        if (c.source === 'frozen-159') {
            item.exactHistoricalPath = JSON.stringify(expected.get(c.id)) === JSON.stringify(raw.result.solutionPath);
            if (!item.exactHistoricalPath) failures.push(item);
        }
    } else if (c.source === 'frozen-159') failures.push({ ...item, error: 'frozen case unsolved' });
    if (c.source === 'independent-prespecified' && c.expectation === 'reachable' && row.status !== 'SOLVED') {
        failures.push({ ...item, error: 'reachable holdout unsolved' });
    }
    ledger.push(item);
}
assert.deepEqual(failures, []);
const report = { rows: rows.length, validatedPaths: ledger.filter(x => x.oracleValid).length,
    frozenExactPaths: ledger.filter(x => x.exactHistoricalPath).length,
    failures, ledger };
fs.writeFileSync(path.join(root, 'validation-ledger.json'), JSON.stringify(report, null, 2) + '\n');
console.log({ rows: report.rows, validatedPaths: report.validatedPaths, frozenExactPaths: report.frozenExactPaths, failures: 0 });
