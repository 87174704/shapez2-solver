import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const entry = path.join(root, 'scripts/ci/verify-history.mjs');
const run = (cwd, args = []) => spawnSync(process.execPath, [entry, ...args], {
  cwd, encoding: 'utf8', timeout: 60_000, maxBuffer: 2 * 1024 * 1024,
});
async function assertCleaned(result) {
  assert.equal(result.status, 1, result.stdout + result.stderr);
  const cleaned = result.stdout.match(/^CLEANED: (.+)$/m)?.[1].trim();
  assert.ok(cleaned, result.stdout + result.stderr);
  assert.equal(path.dirname(cleaned), path.resolve(os.tmpdir()));
  await assert.rejects(fs.access(cleaned), { code: 'ENOENT' });
}

test('historical entry refuses caller-selected identity inputs', () => {
  for (const argument of ['HEAD', '--manifest=forged.json', '--root=.', '--ref=HEAD']) {
    const result = run(root, [argument]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage:/);
    assert.doesNotMatch(result.stdout, /RUN:/);
  }
});

test('missing fixed Git objects fail closed and remove the temporary snapshot', async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'history-missing-test-'));
  try {
    execFileSync('git', ['init', '--bare', temporary], { stdio: 'pipe' });
    const result = run(temporary);
    await assertCleaned(result);
    assert.doesNotMatch(result.stdout, /PASS:/);
    assert.match(result.stderr, /5fbba47c9a2c6c3cbdb346bd7e935b08018f6d17/);
  } finally {
    assert.equal(path.dirname(temporary), path.resolve(os.tmpdir()));
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test('missing original tag fails even when every historical object is available', async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'history-tag-test-'));
  const repository = path.join(temporary, 'objects.git');
  try {
    execFileSync('git', ['clone', '--bare', '--shared', root, repository], { stdio: 'pipe' });
    execFileSync('git', ['-C', repository, 'update-ref', '-d', 'refs/tags/hard-capable-v1']);
    const result = run(repository);
    await assertCleaned(result);
    assert.match(result.stderr, /hard-capable-v1/);
    assert.doesNotMatch(result.stdout, /RUN: locked-dependencies/);
  } finally {
    assert.equal(path.dirname(temporary), path.resolve(os.tmpdir()));
    await fs.rm(temporary, { recursive: true, force: true });
  }
});
