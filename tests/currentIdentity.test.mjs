import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from '../versions/identity.mjs';
import { verifyCurrentInputs, verifyCurrentSource, prepareCurrentInputs, HISTORY } from '../versions/current.mjs';

test('maintenance source permits committed validator evolution and rejects inconsistent or frozen inputs', async t => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'shapez2-current-test-'));
  const root = path.join(temporary, 'source');
  const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  const saveCommit = () => {
    git('add', '--all');
    git('-c', 'user.name=Maintenance test', '-c', 'user.email=maintenance-test@invalid',
      '-c', 'core.hooksPath=', 'commit', '--no-gpg-sign', '-qm', 'isolated maintenance test');
    return git('rev-parse', 'HEAD');
  };
  try {
    execFileSync('git', ['clone', '--shared', '--no-checkout', ROOT, root], { stdio: 'pipe' });
    const initial = execFileSync('git', ['--no-replace-objects', 'rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
    git('checkout', '--detach', initial);
    await prepareCurrentInputs({ root });
    assert.equal((await verifyCurrentSource({ root, commit: initial })).sourceCommit, initial);
    await t.test('explicit source selection cannot be replaced by HEAD or another commit', async () => {
      await assert.rejects(verifyCurrentSource({ root, commit: 'HEAD' }), /Explicit full/);
      await assert.rejects(verifyCurrentSource({ root, commit: HISTORY }), /HEAD differs/);
    });
    await t.test('actual source and untracked inputs must agree with selected Git', async () => {
      const target = path.join(root, 'main.js'), bytes = await fs.readFile(target);
      await fs.appendFile(target, '\n// undeclared publishing change\n');
      await assert.rejects(verifyCurrentSource({ root, commit: initial }), /Source differs.*main.js/);
      await fs.writeFile(target, bytes);
      const extra = path.join(root, 'unreviewed.js'); await fs.writeFile(extra, '// input\n');
      await assert.rejects(verifyCurrentSource({ root, commit: initial }), /Untracked source inputs/);
      await fs.unlink(extra);
    });
    let evolved;
    await t.test('a reviewed validator comment is a new maintenance identity', async () => {
      await fs.appendFile(path.join(root, 'tests/tools/validateCurrentPhysics.mjs'), '\n// maintenance evolution experiment\n');
      evolved = saveCommit();
      const identity = await verifyCurrentSource({ root, commit: evolved });
      assert.equal(identity.sourceCommit, evolved);
      assert.equal(identity.immutable.valid, true);
    });
    await t.test('a committed frozen-data edit is rejected', async () => {
      const file = path.join(root, 'benchmarks/input_catalog.json');
      const bytes = await fs.readFile(file);
      await fs.appendFile(file, '\n');
      const forged = saveCommit();
      const input = await verifyCurrentInputs({ root });
      assert.equal(input.valid, false);
      assert.ok(input.errors.includes('immutable: benchmarks/input_catalog.json hash differs'));
      await assert.rejects(verifyCurrentSource({ root, commit: forged }), /immutable: benchmarks\/input_catalog.json/);
      // Even restoring old working bytes cannot certify a different committed blob.
      await fs.writeFile(file, bytes);
      await assert.rejects(verifyCurrentSource({ root, commit: forged }), /Source differs.*benchmarks\/input_catalog.json/);
    });
    await t.test('restoration refuses real tampering rather than converting it to a pass', async () => {
      await fs.writeFile(path.join(root, 'benchmarks/input_catalog.json'), '{}\n');
      await assert.rejects(prepareCurrentInputs({ root }), /Content differs from pinned identity/);
    });
  } finally {
    assert.equal(path.dirname(temporary), path.resolve(os.tmpdir()));
    assert.ok(path.basename(temporary).startsWith('shapez2-current-test-'));
    await fs.rm(temporary, { recursive: true, force: true });
  }
});
