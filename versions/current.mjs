// Maintenance certification: Git-selected source plus original immutable inputs.
// This is not a Release 1 certificate and has no mutable source manifest/pin.
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { ROOT, sha256, canonical } from './identity.mjs';

export const HISTORY = '5fbba47c9a2c6c3cbdb346bd7e935b08018f6d17';
const git = (root, args, input) => execFileSync('git', ['--no-replace-objects', ...args],
  { cwd: root, input, maxBuffer: 256 * 1024 * 1024 });
const tree = (root, ref) => git(root, ['ls-tree', '-rz', ref]).toString().split('\0').filter(Boolean).map(line => {
  const [mode, type, oid] = line.slice(0, line.indexOf('\t')).split(' ');
  return { path: line.slice(line.indexOf('\t') + 1), mode, type, oid };
});
const historicalJson = (root, name) => JSON.parse(git(root, ['show', `${HISTORY}:${name}`]));

async function frozenBindings(root) {
  const manifest = historicalJson(root, 'versions/shape-operations-v2-support-closure.json');
  const inventory = historicalJson(root, manifest.frozenInventory.path);
  const bindings = new Map([...manifest.semantics.files,
    ...inventory.files.filter(f => f.path.startsWith('benchmarks/') || f.path === 'docs/benchmark/USER_RULES.md')]
    .map(f => [f.path, f]));
  // Bind the historical trust documents and reviewed control/holdout data directly to Git.
  const historicalTree = tree(root, HISTORY);
  const extra = historicalTree.filter(f => f.path.startsWith('versions/') ||
    f.path.startsWith('tests/fixtures/physics-v2/') ||
    ['tests/strict-routing/holdouts.json', 'tests/strict-routing/holdout-lock.json'].includes(f.path));
  for (const f of extra) bindings.set(f.path, { path: f.path, sha256: sha256(git(root, ['cat-file', 'blob', f.oid])) });
  for (const f of historicalTree) if (bindings.has(f.path)) bindings.get(f.path).gitBlob = f.oid;
  return { manifest, bindings };
}

export async function verifyCurrentInputs({ root = ROOT } = {}) {
  const { manifest, bindings } = await frozenBindings(root);
  const errors = [];
  for (const f of bindings.values()) {
    try { if (sha256(await fs.readFile(path.join(root, f.path))) !== f.sha256) errors.push(`immutable: ${f.path} hash differs`); }
    catch { errors.push(`immutable: ${f.path} missing`); }
  }
  return { valid: !errors.length, certification: 'maintenance-inputs/1', historyCommit: HISTORY,
    physicsSemantics: manifest.version, semanticsSha256: manifest.semantics.sha256,
    frozenFilesChecked: [...bindings.keys()].filter(f => f.startsWith('benchmarks/')).length,
    immutableFilesChecked: bindings.size, errors };
}

// Only reconstruct immutable working representations; never restore current scripts/source.
export async function prepareCurrentInputs({ root = ROOT } = {}) {
  const { bindings } = await frozenBindings(root);
  const { restore } = await import('../tools/release1/prepare.mjs');
  await restore(root, [...bindings.values()]);
  const result = await verifyCurrentInputs({ root });
  assert.ok(result.valid, result.errors.join('\n'));
  return result;
}

export async function verifyCurrentSource({ root = ROOT, commit } = {}) {
  assert.match(commit ?? '', /^[0-9a-f]{40}$/, 'Explicit full --commit=<OID> required');
  assert.equal(git(root, ['rev-parse', `${commit}^{commit}`]).toString().trim(), commit);
  assert.equal(git(root, ['rev-parse', 'HEAD']).toString().trim(), commit, 'HEAD differs from selected source');
  const entries = tree(root, commit);
  const { bindings } = await frozenBindings(root);
  const objects = git(root, ['cat-file', '--batch'], entries.map(f => f.oid).join('\n') + '\n');
  let offset = 0;
  for (const f of entries) {
    assert.equal(f.mode, '100644', `Unsupported source mode: ${f.path}`);
    assert.equal(f.type, 'blob');
    const end = objects.indexOf(10, offset);
    const [oid, type, size] = objects.subarray(offset, end).toString().split(' ');
    assert.equal(oid, f.oid); assert.equal(type, 'blob');
    const blob = objects.subarray(end + 1, end + 1 + Number(size));
    offset = end + 2 + Number(size);
    const file = path.join(root, f.path);
    assert.ok((await fs.lstat(file)).isFile(), `Non-regular source: ${f.path}`);
    // Reject directory junctions/symlinks too; dependency junctions are audited separately.
    assert.equal(await fs.realpath(file), path.join(await fs.realpath(root), f.path), `Redirected source: ${f.path}`);
    const bytes = await fs.readFile(file);
    const binding = bindings.get(f.path);
    // Original frozen checkout bytes may differ from their Git LF representation.
    if (!bytes.equals(blob)) assert.ok(binding && f.oid === binding.gitBlob && sha256(bytes) === binding.sha256,
      `Source differs from selected Git blob: ${f.path}`);
  }
  assert.equal(offset, objects.length);
  const extra = git(root, ['ls-files', '--others', '--exclude-standard', '-z']).toString().split('\0').filter(Boolean);
  assert.deepEqual(extra, [], 'Untracked source inputs');
  const immutable = await verifyCurrentInputs({ root });
  assert.ok(immutable.valid, immutable.errors.join('\n'));
  return { certification: 'maintenance-source/1', sourceCommit: commit,
    sourceTree: git(root, ['rev-parse', `${commit}^{tree}`]).toString().trim(),
    trackedFilesChecked: entries.length, immutable };
}

export function selectedCommit(args = process.argv.slice(2)) {
  const flags = args.filter(a => a.startsWith('--commit='));
  assert.equal(flags.length, 1, 'Exactly one explicit --commit=<full OID> required');
  return flags[0].slice('--commit='.length);
}

export function sourceFiles({ root = ROOT, commit } = {}) {
  assert.match(commit ?? '', /^[0-9a-f]{40}$/);
  return tree(root, commit).map(f => f.path);
}

export async function applicationFiles({ root = ROOT, commit } = {}) {
  // Current Git inventory, not a frozen Release runtime list. Reference closure is
  // checked independently by static verification (imports, workers, HTML and CSS).
  return sourceFiles({ root, commit }).filter(f => /^[^/]+\.js$/.test(f) ||
    /^(constructive|locales)\/.*\.js$/.test(f) || f.startsWith('images/'));
}

export const identityDigest = identity => sha256(canonical(identity));
