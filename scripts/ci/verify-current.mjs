// Current maintenance gate. Historical certification remains verify-history.mjs.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ROOT } from '../../versions/identity.mjs';
import { selectedCommit, prepareCurrentInputs, verifyCurrentSource } from '../../versions/current.mjs';
import { verifyDependencies, verifyInstalledDependencies } from '../../tools/static-build/current-dependencies.mjs';

const run = promisify(execFile), commit = selectedCommit();
assert.equal(process.argv.length, 3, 'Usage: node scripts/ci/verify-current.mjs --commit=<full OID>');
const output = path.join(ROOT, '.ci-results/current');
await fs.mkdir(output, { recursive: true });
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'shapez2-current-'));
const historical = path.join(temporary, 'v1');
const summary = { certification: 'maintenance-behavior/1', sourceCommit: commit, phases: [] };
async function phase(name, operation) {
  console.log(`RUN: ${name}`);
  const started = Date.now();
  try {
    const value = await operation();
    await fs.writeFile(path.join(output, name + '.log'), typeof value === 'string' ? value : JSON.stringify(value, null, 2));
    summary.phases.push({ name, passed: true, elapsedMs: Date.now() - started });
    console.log(`PASS: ${name}`);
    return value;
  } catch (error) {
    await fs.writeFile(path.join(output, name + '.log'), `${error.stack}\n${error.stdout ?? ''}\n${error.stderr ?? ''}`);
    summary.phases.push({ name, passed: false, elapsedMs: Date.now() - started });
    throw error;
  }
}
async function node(args, cwd = ROOT) {
  const { stdout, stderr } = await run(process.execPath, args, { cwd, timeout: 20 * 60 * 1000,
    maxBuffer: 64 * 1024 * 1024, env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' } });
  return stdout + stderr;
}
try {
  await phase('immutable-representation', () => prepareCurrentInputs());
  summary.identity = await phase('current-source', () => verifyCurrentSource({ commit }));
  summary.dependencies = await phase('locked-dependencies', () => verifyDependencies(ROOT));
  // Syntax and documentation retain the original complete assertions without the
  // old gate's current-checkout Release identity/history phases.
  await phase('syntax', async () => {
    const { stdout } = await run('git', ['--no-replace-objects', 'ls-files', '-z'], { cwd: ROOT });
    const files = stdout.split('\0').filter(f => /\.(js|mjs)$/.test(f));
    for (const f of files) await node(['--check', f]);
    return `Syntax checked ${files.length} JS/MJS files.`;
  });
  await phase('documentation', async () => {
    const files = ['README.md', ...await Promise.all(['docs/legal', 'docs/release', 'docs/physics-fix-20261029'].map(async dir =>
      (await fs.readdir(path.join(ROOT, dir))).filter(f => f.endsWith('.md')).map(f => `${dir}/${f}`))).then(rows => rows.flat()),
      'docs/benchmark/PROVENANCE.md', 'docs/benchmark/REPRODUCIBILITY.md'];
    let checked = 0;
    for (const f of files) for (const m of (await fs.readFile(path.join(ROOT, f), 'utf8')).matchAll(/\]\(([^)]+)\)/g)) {
      const target = m[1].split('#')[0]; if (!target || /^[a-z]+:/i.test(target)) continue;
      const resolved = path.resolve(ROOT, path.dirname(f), decodeURIComponent(target));
      assert.ok(resolved.startsWith(path.resolve(ROOT) + path.sep), `${f} -> ${target}`);
      await fs.access(resolved); checked++;
    }
    return `Checked ${checked} local documentation links.`;
  });
  await phase('historical-v1', () => node(['tests/tools/runHistoricalV1.mjs', historical]));
  await phase('frozen-evidence-v1', () => node(['scripts/ci/verify-frozen.mjs', historical]));
  await phase('regressions-current', () => node(['--test', '--test-reporter=tap']));
  for (const f of ['input-lateral.json', 'input-propagation-controls.json'])
    await fs.copyFile(path.join(ROOT, 'tests/fixtures/physics-v2', f), path.join(output, f));
  await phase('acceptance-current', () => node(['tests/tools/validateCurrentPhysics.mjs', output, historical]));
  await phase('current-solver-159', () => node(['tests/tools/verifyBrowserSafeProduction.mjs']));
  await phase('static-profiles-current', () => node(['tools/static-build/verify-current.mjs', `--commit=${commit}`]));
  assert.deepEqual(await verifyCurrentSource({ commit }), summary.identity, 'Source changed during verification');
  await verifyInstalledDependencies(ROOT, summary.dependencies);
  summary.passed = true;
} catch (error) {
  summary.passed = false; console.error(error.stack); process.exitCode = 1;
} finally {
  await fs.writeFile(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  assert.equal(path.dirname(temporary), path.resolve(os.tmpdir()));
  assert.ok(path.basename(temporary).startsWith('shapez2-current-'));
  await fs.rm(temporary, { recursive: true, force: true });
  console.log(`CLEANED: ${temporary}`);
}
