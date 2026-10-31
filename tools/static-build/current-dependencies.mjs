// Audit actual installed packages against a fresh npm extraction authenticated by
// the Git-selected package-lock SRI. Output hashes are records, never trust roots.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { sha256, canonical } from '../../versions/identity.mjs';
const run = promisify(execFile);
async function inventory(dir, prefix = '') {
  const files = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (!prefix && ['.bin', '.package-lock.json'].includes(e.name)) continue;
    const p = prefix + e.name;
    assert.ok(!e.isSymbolicLink(), `Redirected dependency: ${p}`);
    if (e.isDirectory()) files.push(...await inventory(path.join(dir, e.name), p + '/'));
    else files.push([p, sha256(await fs.readFile(path.join(dir, e.name)))]);
  }
  return files.sort((a, b) => a[0].localeCompare(b[0]));
}
export async function verifyInstalledDependencies(root, authenticated) {
  for (const record of authenticated) {
    const source = path.join(root, record.path);
    assert.equal(sha256(await fs.readFile(path.join(source, 'package-lock.json'))), record.lockSha256, 'Dependency lock changed during operation');
    assert.equal(sha256(canonical(await inventory(path.join(source, 'node_modules')))), record.installedSha256,
      `Installed dependencies changed during operation: ${record.path}`);
  }
}
export async function verifyDependencies(root) {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'shapez2-dependencies-'));
  const results = [];
  try {
    for (const prefix of ['', 'tools/static-build']) {
      const source = path.join(root, prefix), destination = path.join(temporary, prefix || 'app');
      await fs.mkdir(destination, { recursive: true });
      for (const f of ['package.json', 'package-lock.json']) await fs.copyFile(path.join(source, f), path.join(destination, f));
      const lock = JSON.parse(await fs.readFile(path.join(destination, 'package-lock.json')));
      for (const [name, pkg] of Object.entries(lock.packages).filter(([name]) => name)) {
        assert.ok(!pkg.link && /^https:\/\//.test(pkg.resolved) && /^sha512-/.test(pkg.integrity), `Unauthenticated dependency: ${name}`);
      }
      const nodeDirectory = path.dirname(await fs.realpath(process.execPath));
      const candidates = [path.join(nodeDirectory, 'node_modules/npm/bin/npm-cli.js'),
        path.resolve(nodeDirectory, '../lib/node_modules/npm/bin/npm-cli.js')];
      let npm;
      for (const candidate of candidates) {
        try { await fs.access(candidate); npm = candidate; break; } catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
      assert.ok(npm, 'The selected Node installation must include npm');
      await run(process.execPath, [npm, 'ci', '--ignore-scripts', '--no-audit', '--no-fund'],
        { cwd: destination, timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
      const expected = await inventory(path.join(destination, 'node_modules'));
      assert.deepEqual(await inventory(path.join(source, 'node_modules')), expected, `Installed dependencies differ: ${prefix || 'app'}`);
      results.push({ path: prefix || '.', lockSha256: sha256(await fs.readFile(path.join(source, 'package-lock.json'))),
        files: expected.length, installedSha256: sha256(canonical(expected)) });
    }
    return results;
  } finally {
    assert.equal(path.dirname(temporary), path.resolve(os.tmpdir()));
    assert.ok(path.basename(temporary).startsWith('shapez2-dependencies-'));
    await fs.rm(temporary, { recursive: true, force: true });
  }
}
