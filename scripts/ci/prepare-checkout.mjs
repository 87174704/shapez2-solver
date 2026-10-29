import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { ROOT, sha256 } from '../../versions/identity.mjs';

// Restore representation only when the bytes exactly match the existing pin.
// Git blobs, historical records and correctness expectations are never rewritten.
const inventory = JSON.parse(fs.readFileSync(path.join(ROOT, 'versions/frozen-v1.inventory.json')));
const current = JSON.parse(fs.readFileSync(path.join(ROOT, 'versions/shape-operations-v2-support-closure.json')));
const changed = new Set(['.gitattributes', 'README.md', 'package.json', 'release.json', 'shapeOperations.js', 'tests/benchmark.test.mjs', 'tests/compositeRelease.test.mjs']);
const files = [...inventory.files.filter(f => !changed.has(f.path)), ...current.acceptance.files];
const restored = [];
for (const f of files) {
  const target = path.join(ROOT, f.path), before = fs.readFileSync(target);
  if (sha256(before) === f.sha256) continue;
  const lf = Buffer.from(before.toString('utf8').replaceAll('\r\n', '\n'));
  const crlf = Buffer.from(lf.toString('utf8').replaceAll('\n', '\r\n'));
  let mixed;
  if (f.mixedNewlineRecipe && sha256(lf) === f.mixedNewlineRecipe.normalizedLfSha256) {
    const lines = lf.toString('utf8').split('\n');
    for (const i of f.mixedNewlineRecipe.crlfLineIndices) lines[i] += '\r';
    mixed = Buffer.from(lines.join('\n'));
  }
  const exact = [lf, crlf, mixed].filter(Boolean).find(b => sha256(b) === f.sha256);
  assert.ok(exact, `Cannot restore pinned representation: ${f.path}`);
  fs.writeFileSync(target, exact); restored.push({ path: f.path, beforeSha256: sha256(before), sha256: sha256(exact) });
}
console.log(JSON.stringify({ restored, frozenFilesChecked: inventory.files.filter(f => f.path.startsWith('benchmarks/')).length }, null, 2));
