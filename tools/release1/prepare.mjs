import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { ROOT, json, sha256, verifyVersion } from '../../versions/identity.mjs';
export const BASE = 'ec9cc5cb633d021b6af276565223a392f8329b87';
export async function restore(root, pins) {
  const restored = [];
  for (const f of pins) {
    const file = path.resolve(root, f.path);
    assert.ok(file.startsWith(path.resolve(root) + path.sep));
    const bytes = await fs.readFile(file);
    if (sha256(bytes) === f.sha256) continue;
    const lf = Buffer.from(bytes.toString('utf8').replaceAll('\r\n', '\n'));
    const crlf = Buffer.from(lf.toString().replaceAll('\n', '\r\n'));
    let mixed;
    if (f.mixedNewlineRecipe && sha256(lf) === f.mixedNewlineRecipe.normalizedLfSha256) {
      const lines = lf.toString().split('\n');
      for (const i of f.mixedNewlineRecipe.crlfLineIndices) lines[i] += '\r';
      mixed = Buffer.from(lines.join('\n'));
    }
    const exact = [lf, crlf, mixed].filter(Boolean).find(b => sha256(b) === f.sha256);
    assert.ok(exact, `Content differs from pinned identity: ${f.path}`);
    await fs.writeFile(file, exact); restored.push(f.path);
  }
  return restored;
}
export async function prepareOldRC(destination) {
  await fs.mkdir(destination, { recursive: false });
  const archive = path.join(destination, 'baseline.tar');
  execFileSync('git', ['archive', '--format=tar', `--output=${archive}`, BASE], { cwd: ROOT });
  execFileSync('tar', ['-xf', archive, '-C', destination]);
  const m = await json(path.join(destination, 'versions/shape-operations-v2-support-closure.json'));
  const inv = await json(path.join(destination, 'versions/frozen-v1.inventory.json'));
  await restore(destination, [...m.semantics.files, ...m.runtime.files, ...m.acceptance.files,
    ...inv.files.filter(f => f.path.startsWith('benchmarks/'))]);
  const identity = await verifyVersion({ version: m.version, root: destination });
  assert.ok(identity.valid, identity.errors.join('\n'));
  await fs.writeFile(path.join(destination, 'verified-identity.json'), JSON.stringify(identity, null, 2));
  return identity;
}
