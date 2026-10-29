import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, json, sha256, canonical, aggregate } from './identity.mjs';

export const RELEASE = 'shapez2-solver-release1';
export const MANIFEST = 'versions/shapez2-solver-release1.json';
export const PIN = 'versions/release1.pin.json';
export const excluded = p => [MANIFEST, PIN].includes(p) || p.startsWith('docs/release1/');

// Separate trust root for this release. Historical verifyVersion remains strict
// and continues to reject this implementation as the old Physics v2 RC.
export async function verifyRelease({ root = ROOT, manifestDocument } = {}) {
  const errors = [];
  const pin = await json(path.join(ROOT, PIN));
  const m = manifestDocument ?? await json(path.join(ROOT, MANIFEST));
  if (sha256(canonical(m)) !== pin.canonicalSha256) errors.push('release manifest differs from trusted pin');
  if (m.release !== RELEASE) errors.push('wrong release');
  const old = await json(path.join(ROOT, 'versions/shape-operations-v2-support-closure.json'));
  const index = await json(path.join(ROOT, 'versions/index.json'));
  if (sha256(canonical(old)) !== index.versions[old.version].canonicalSha256 ||
      m.physicsManifestCanonicalSha256 !== index.versions[old.version].canonicalSha256) errors.push('Physics v2 trust root differs');
  if (canonical(m.semantics) !== canonical(old.semantics)) errors.push('Physics v2 semantics binding differs');
  if (canonical(m.frozenInventory) !== canonical(old.frozenInventory)) errors.push('frozen inventory binding differs');
  for (const key of ['semantics', 'runtime', 'source']) {
    const set = m[key];
    if (!set?.files?.length || new Set(set.files.map(f => f.path)).size !== set.files.length ||
        aggregate(set.files) !== set.sha256) { errors.push(`${key} binding invalid`); continue; }
    for (const f of set.files) {
      const file = path.resolve(root, f.path);
      if (!file.startsWith(path.resolve(root) + path.sep)) { errors.push(`unsafe path ${f.path}`); continue; }
      try { if (sha256(await fs.readFile(file)) !== f.sha256) errors.push(`${key}: ${f.path} hash differs`); }
      catch { errors.push(`${key}: ${f.path} missing`); }
    }
  }
  const inventoryBytes = await fs.readFile(path.join(ROOT, old.frozenInventory.path));
  if (sha256(inventoryBytes) !== old.frozenInventory.sha256) errors.push('frozen inventory hash differs');
  let frozenFilesChecked = 0;
  for (const f of JSON.parse(inventoryBytes).files.filter(f => f.path.startsWith('benchmarks/'))) {
    try { if (sha256(await fs.readFile(path.join(root, f.path))) !== f.sha256) errors.push(`frozen: ${f.path} hash differs`); }
    catch { errors.push(`frozen: ${f.path} missing`); }
    frozenFilesChecked++;
  }
  return { valid: errors.length === 0, release: RELEASE, manifestCanonicalSha256: pin.canonicalSha256,
    physicsSemantics: old.version, semanticsSha256: old.semantics.sha256,
    sourceSha256: m.source.sha256, sourceFilesChecked: m.source.files.length,
    frozenFilesChecked, errors };
}
