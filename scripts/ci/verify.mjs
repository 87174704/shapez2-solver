import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sha256 } from '../../versions/identity.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.join(root, '.ci-results');
const historical = path.join(output, 'historical-v1');
fs.mkdirSync(output, { recursive: true });
const git = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 32 * 1024 * 1024 });
const summary = { sourceCommit: git('rev-parse', 'HEAD').toString().trim(), sourceTree: git('rev-parse', 'HEAD^{tree}').toString().trim(),
  node: process.version, npmLockSha256: sha256(fs.readFileSync(path.join(root, 'package-lock.json'))),
  platform: process.platform, arch: process.arch, osRelease: os.release(), startedAt: new Date().toISOString(), phases: [] };
function phase(name, operation) {
  const start = Date.now(); let exitCode = 0, log = '';
  try { log = operation() ?? ''; } catch (error) { exitCode = 1; log = error.stack ?? String(error); }
  fs.writeFileSync(path.join(output, name + '.log'), log);
  summary.phases.push({ name, exitCode, elapsedMs: Date.now() - start });
  console.log(`${exitCode ? 'FAIL' : 'PASS'}: ${name}`);
}
function node(args, cwd = root) {
  const r = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 20 * 60 * 1000 });
  const log = (r.stdout ?? '') + (r.stderr ?? '');
  if (r.error || r.status !== 0) throw Error(`Node exit ${r.status}: ${r.error ?? ''}\n${log}`);
  return log;
}
phase('working-representation', () => node(['scripts/ci/prepare-checkout.mjs']));
phase('history', () => {
  const m = JSON.parse(fs.readFileSync(path.join(root, 'docs/release/frozen-maintenance.json')));
  assert.equal(git('rev-parse', `${m.head}^{tree}`).toString().trim(), m.tree);
  for (const c of m.commits) {
    assert.equal(sha256(git('cat-file', 'commit', c.oid)), c.rawSha256);
    git('merge-base', '--is-ancestor', c.oid, 'HEAD');
  }
  assert.equal(git('rev-parse', 'refs/tags/hard-capable-v1').toString().trim(), m.tag.oid);
  assert.equal(sha256(git('cat-file', 'tag', m.tag.oid)), m.tag.rawSha256);
  assert.equal(git('rev-parse', `${m.tag.oid}^{commit}`).toString().trim(), m.tagTarget);
  const allowed = new Set(['.gitattributes', 'README.md', 'package.json', 'release.json', 'shapeOperations.js', 'tests/benchmark.test.mjs', 'tests/compositeRelease.test.mjs']);
  for (const f of m.files.filter(f => !allowed.has(f.path))) {
    assert.equal(sha256(fs.readFileSync(path.join(root, f.path))), f.originalWorkingSha256, f.path);
    assert.equal(git('rev-parse', `HEAD:${f.path}`).toString().trim(), f.blob, `original blob ${f.path}`);
  }
  return JSON.stringify({ originalCommits: m.commits.length, tag: m.tag, unchangedOriginalFiles: m.files.length - allowed.size, reviewedChangedOriginalFiles: [...allowed] }, null, 2);
});
phase('version-v2', () => node(['--input-type=module', '-e', "import {verifyVersion} from './versions/identity.mjs'; const r=await verifyVersion({version:'shape-operations-v2-support-closure'}); console.log(JSON.stringify(r)); if(!r.valid)process.exitCode=1;"]));
phase('syntax', () => {
  const files = git('ls-files', '--cached', '--others', '--exclude-standard', '-z').toString().split('\0').filter(p => /\.(js|mjs)$/.test(p));
  for (const file of files) node(['--check', file]);
  return `Syntax checked ${files.length} JS/MJS files.\n`;
});
phase('documentation', () => {
  const files = ['README.md', ...['docs/legal', 'docs/release', 'docs/physics-fix-20261029'].flatMap(dir => fs.readdirSync(path.join(root, dir)).filter(p => p.endsWith('.md')).map(p => `${dir}/${p}`)), 'docs/benchmark/PROVENANCE.md', 'docs/benchmark/REPRODUCIBILITY.md'];
  const tracked = new Set(git('ls-files', '--cached', '--others', '--exclude-standard', '-z').toString().split('\0'));
  let checked = 0;
  for (const file of files.filter(p => tracked.has(p))) for (const m of fs.readFileSync(path.join(root, file), 'utf8').matchAll(/\]\(([^)]+)\)/g)) {
    const target = m[1].split('#')[0]; if (!target || /^[a-z]+:/i.test(target)) continue;
    const resolved = path.resolve(root, path.dirname(file), decodeURIComponent(target));
    assert.ok(resolved.startsWith(root + path.sep) && fs.existsSync(resolved), `${file} -> ${target}`); checked++;
  }
  return `Checked ${checked} local documentation links.\n`;
});
phase('historical-v1', () => node(['tests/tools/runHistoricalV1.mjs', historical]));
phase('frozen-evidence-v1', () => node(['scripts/ci/verify-frozen.mjs', historical]));
phase('regressions-v2', () => node(['--test', '--test-reporter=tap']));
for (const name of ['input-lateral.json', 'input-propagation-controls.json']) fs.copyFileSync(path.join(root, 'tests/fixtures/physics-v2', name), path.join(output, name));
phase('acceptance-v2', () => node(['tests/tools/validatePhysicsV2.mjs', output, historical]));
phase('current-solver-159', () => node(['tests/tools/verifyBrowserSafeProduction.mjs']));
summary.finishedAt = new Date().toISOString(); summary.passed = summary.phases.every(p => p.exitCode === 0);
summary.finalWorkingTreeStatus = git('status', '--porcelain=v1').toString();
fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
const names = fs.readdirSync(output).filter(p => fs.statSync(path.join(output, p)).isFile() && p !== 'SHA256SUMS.json');
fs.writeFileSync(path.join(output, 'SHA256SUMS.json'), JSON.stringify(Object.fromEntries(names.map(p => [p, sha256(fs.readFileSync(path.join(output, p)))])), null, 2) + '\n');
process.exitCode = summary.passed ? 0 : 1;
