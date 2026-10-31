import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { ROOT, sha, readJson, writeJson } from '../static-build/shared.mjs';
const measured = await readJson('docs/strict-orientation-constructive-20261030/measured-cases.json');
const holdouts = await readJson('tests/strict-routing/holdouts.json');
const cases = [...measured.filter(c => !c.id.startsWith('hard-') && c.tier !== 'holdout'), ...holdouts];
const rows = [];
for (const c of cases) {
    const child = spawn(process.execPath, ['tools/i18n/ordinary-worker.mjs'], { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', timedOut = false;
    child.stdout.on('data', x => stdout += x); child.stderr.on('data', x => stderr += x);
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, 20000);
    child.stdin.end(JSON.stringify(c.input));
    const exitCode = await new Promise(resolve => child.on('close', resolve)); clearTimeout(timer);
    const observed = exitCode === 0 ? JSON.parse(stdout) : null;
    const expectedNegative = c.expectation && c.expectation !== 'reachable';
    const passed = observed && (expectedNegative
        ? !observed.solved && observed.result.outcome === 'exhausted'
        : observed.solved && observed.replayValid && observed.independentReplayValid);
    rows.push({ id: c.id, tier: c.tier, expectation: c.expectation ?? 'reachable', status: passed ? 'PASS' : 'FAIL',
        inputSha256: sha(JSON.stringify(c.input)), exitCode, timedOut, stderr, ...observed });
    console.log(`${c.id}: ${passed ? 'PASS' : 'FAIL'}`);
}
const report = { status: rows.every(r => r.status === 'PASS') ? 'PASS' : 'FAIL', ordinary: rows.filter(r => r.tier !== 'holdout').length,
    holdouts: rows.filter(r => r.tier === 'holdout').length, solved: rows.filter(r => r.solved).length,
    exhausted: rows.filter(r => r.result?.outcome === 'exhausted').length, dualReplay: rows.filter(r => r.replayValid && r.independentReplayValid).length, cases: rows };
await writeJson('docs/release1/i18n/evidence/ordinary.json', report);
console.log(JSON.stringify({ ...report, cases: undefined }));
if (report.status !== 'PASS') process.exitCode = 1;
