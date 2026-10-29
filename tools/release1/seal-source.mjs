import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { ROOT, json, sha256, canonical, aggregate } from '../../versions/identity.mjs';
import { RELEASE, MANIFEST, PIN, excluded } from '../../versions/release1.mjs';
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64*1024*1024 }).trim();
const old = await json(path.join(ROOT, 'versions/shape-operations-v2-support-closure.json'));
const binding = async p => {
  const b = await fs.readFile(path.join(ROOT, p));
  const result = { path: p, sha256: sha256(b) };
  const text = b.toString('utf8');
  // Explicit representation recipes only; no content normalization on acceptance.
  if (Buffer.from(text).equals(b) && text.includes('\r\n') && text.replaceAll('\r\n','').includes('\n')) {
    const lines = text.split('\n');
    result.mixedNewlineRecipe = { normalizedLfSha256: sha256(Buffer.from(text.replaceAll('\r\n','\n'))),
      crlfLineIndices: lines.flatMap((line,i) => line.endsWith('\r') ? [i] : []) };
  }
  return result;
};
const sourceFiles = git('ls-files','-z').split('\0').filter(p => p && !excluded(p)).sort();
const runtime = { files: await Promise.all([...old.runtime.files.map(f=>f.path), 'constructive/validate-strict-plan.js'].sort().map(binding)) };
runtime.sha256 = aggregate(runtime.files);
const release = await json(path.join(ROOT,'release.json'));
release.runtimeIdentitySha256 = runtime.sha256;
await fs.writeFile(path.join(ROOT,'release.json'),JSON.stringify(release,null,2)+'\n');
const source = { files: await Promise.all(sourceFiles.map(binding)) };
source.sha256 = aggregate(source.files);
const changedOriginalFiles = git('diff','--cached','--name-only','ec9cc5cb633d021b6af276565223a392f8329b87','--').split('\n').filter(Boolean);
const m = { schemaVersion: 1, release: RELEASE,
  baselineCommit: 'ec9cc5cb633d021b6af276565223a392f8329b87',
  baselineTree: '4e49a58cd2d89923ebea189ffbfc9ab9b1049d87',
  physicsManifestCanonicalSha256: sha256(canonical(old)), semantics: old.semantics,
  frozenInventory: old.frozenInventory, runtime, source,
  exclusions: ['versions/shapez2-solver-release1.json','versions/release1.pin.json','docs/release1/**'],
  exclusionReason: 'Manifest/pin avoid self reference; release reports are post-validation evidence. Complete Git HEAD/tree additionally binds every tracked file in build-manifest.json.',
  reviewedChangesFromBaseline: changedOriginalFiles,
  routing: { strictOrdinaryDefault: true, featureFlag: false, budgetMs: 50, budgetKind: 'cooperative construction and replay cutoff; elapsed time deducted from general search budget' },
  gameCertification: 'UNKNOWN' };
assert.equal(m.physicsManifestCanonicalSha256,'3d678923c491776c524f790593815a7b1f44c99621284a0c33e0ec32bed5ca06');
await fs.writeFile(path.join(ROOT,MANIFEST),JSON.stringify(m,null,2)+'\n');
await fs.writeFile(path.join(ROOT,PIN),JSON.stringify({ release:RELEASE, path:MANIFEST, canonicalSha256:sha256(canonical(m)) },null,2)+'\n');
console.log(JSON.stringify({ sourceFiles: source.files.length, sourceSha256:source.sha256, manifestCanonicalSha256:sha256(canonical(m)) }));
