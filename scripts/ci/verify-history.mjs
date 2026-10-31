// Independent historical certification. The only local input is the Git object database.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

// Existing green Release 1, not HEAD and not a caller-selected manifest or ref.
const RELEASE1_COMMIT = '5fbba47c9a2c6c3cbdb346bd7e935b08018f6d17';
const runFile = promisify(execFile);

export async function verifyHistory() {
  const repository = process.cwd();
  const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], {
    cwd: repository, maxBuffer: 64 * 1024 * 1024,
  });
  // Prevent ambient replacement objects from changing either archives or old helpers.
  const env = { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' };
  const gitDir = git('rev-parse', '--absolute-git-dir').toString().trim();
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'shapez2-history-'));
  const evidenceRoot = path.join(temporary, 'release1');
  const v1Root = path.join(temporary, 'v1');
  const v2Root = path.join(temporary, 'physics-v2');
  const phases = [];
  const load = (root, file) => import(pathToFileURL(path.join(root, file)));
  async function command(name, executable, args, cwd) {
    console.log(`RUN: ${name}`);
    const started = Date.now();
    try {
      const { stdout, stderr } = await runFile(executable, args, {
        cwd, env, timeout: 20 * 60 * 1000, maxBuffer: 64 * 1024 * 1024,
      });
      const log = stdout + stderr;
      await fs.writeFile(path.join(temporary, `${name}.log`), log);
      const counts = log.split(/\r?\n/).filter(line => /^# (tests|pass|fail|skipped) /.test(line));
      const result = { name, elapsedMs: Date.now() - started, counts };
      phases.push(result);
      console.log(`PASS: ${name}${counts.length ? ' (' + counts.join('; ') + ')' : ''}`);
      return log;
    } catch (error) {
      const lines = (error.stdout ?? '').split(/\r?\n/);
      const failures = lines.flatMap((line, index) => /^\s*not ok /.test(line)
        ? lines.slice(Math.max(0, index - 1), index + 45) : []);
      throw Error(`${name} failed\n${failures.length ? failures.join('\n') : error.stdout ?? ''}\n${error.stderr ?? ''}\n${error.message}`);
    }
  }
  const node = (name, args, cwd = evidenceRoot) => command(name, process.execPath, args, cwd);
  async function archive(commit, destination) {
    assert.match(commit, /^[0-9a-f]{40}$/);
    assert.equal(git('rev-parse', `${commit}^{commit}`).toString().trim(), commit);
    await fs.mkdir(destination);
    const tar = path.join(temporary, `${path.basename(destination)}.tar`);
    git('archive', '--format=tar', `--output=${tar}`, commit);
    execFileSync('tar', ['-xf', tar, '-C', destination]);
    await fs.unlink(tar);
  }
  try {
    await archive(RELEASE1_COMMIT, evidenceRoot);
    // Read-only Git discovery for the existing preparers; no clone or worktree registration.
    await fs.writeFile(path.join(evidenceRoot, '.git'), `gitdir: ${gitDir.replaceAll('\\', '/')}\n`);
    const { json, sha256, canonical, verifyVersion } = await load(evidenceRoot, 'versions/identity.mjs');
    const { restore, BASE: v2Commit } = await load(evidenceRoot, 'tools/release1/prepare.mjs');
    const { verifyRelease, MANIFEST, PIN } = await load(evidenceRoot, 'versions/release1.mjs');
    const read = file => json(path.join(evidenceRoot, file));
    const release = await read(MANIFEST);
    const pin = await read(PIN);
    assert.equal(sha256(canonical(release)), pin.canonicalSha256);
    await restore(evidenceRoot, release.source.files);
    const releaseIdentity = await verifyRelease();
    assert.ok(releaseIdentity.valid, releaseIdentity.errors.join('\n'));

    const maintenance = await read('docs/release/frozen-maintenance.json');
    const inventory = await read('versions/frozen-v1.inventory.json');
    assert.equal(inventory.commit, maintenance.head);
    assert.equal(git('rev-parse', `${maintenance.head}^{tree}`).toString().trim(), maintenance.tree);
    for (const commit of maintenance.commits) {
      assert.equal(sha256(git('cat-file', 'commit', commit.oid)), commit.rawSha256);
      git('merge-base', '--is-ancestor', commit.oid, RELEASE1_COMMIT);
    }
    assert.equal(git('rev-parse', 'refs/tags/hard-capable-v1').toString().trim(), maintenance.tag.oid);
    assert.equal(sha256(git('cat-file', 'tag', maintenance.tag.oid)), maintenance.tag.rawSha256);
    assert.equal(git('rev-parse', `${maintenance.tag.oid}^{commit}`).toString().trim(), maintenance.tagTarget);
    assert.equal(release.baselineCommit, v2Commit);
    assert.equal(git('rev-parse', `${v2Commit}^{tree}`).toString().trim(), release.baselineTree);
    git('merge-base', '--is-ancestor', maintenance.head, v2Commit);
    git('merge-base', '--is-ancestor', v2Commit, RELEASE1_COMMIT);

    // Fresh locked dependencies in the disposable snapshot, never current node_modules.
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    // npm.cmd requires a shell on Windows; invoke npm's bundled JS CLI directly instead.
    const npmCli = process.platform === 'win32' ? path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js') : null;
    const installArgs = ['ci', '--ignore-scripts', '--no-audit', '--no-fund'];
    await command('locked-dependencies', npmCli ? process.execPath : npm,
      npmCli ? [npmCli, ...installArgs] : installArgs, evidenceRoot);
    // Run unmodified preparers in children so their Git commands inherit replacement suppression.
    const v1 = JSON.parse(await node('v1-snapshot', ['--input-type=module', '-e',
      "import {prepareHistoricalV1} from './tests/tools/runHistoricalV1.mjs'; console.log(JSON.stringify(await prepareHistoricalV1(process.argv[1])));", v1Root]));
    assert.equal(v1.files, inventory.files.length);
    // All original files: Git blob identity AND original checkout byte identity.
    assert.equal(maintenance.files.length, inventory.files.length);
    const tree = new Map(git('ls-tree', '-rz', maintenance.head).toString().split('\0').filter(Boolean).map(line => {
      const tab = line.indexOf('\t');
      return [line.slice(tab + 1), line.slice(0, tab).split(' ')[2]];
    }));
    // The frozen 593-file inventory contains about 123 MB of blobs.
    let blobs = execFileSync('git', ['--no-replace-objects', 'cat-file', '--batch'], {
      cwd: repository, input: maintenance.files.map(file => file.blob).join('\n') + '\n',
      maxBuffer: 256 * 1024 * 1024,
    });
    let cursor = 0;
    for (const file of maintenance.files) {
      assert.equal(tree.get(file.path), file.blob, file.path);
      const end = blobs.indexOf(10, cursor);
      assert.ok(end >= cursor, 'missing Git batch object header');
      const [oid, type, size] = blobs.subarray(cursor, end).toString().split(' ');
      assert.equal(oid, file.blob); assert.equal(type, 'blob');
      const length = Number(size);
      assert.ok(Number.isSafeInteger(length) && length >= 0);
      cursor = end + 1;
      assert.equal(sha256(blobs.subarray(cursor, cursor + length)), file.gitBlobSha256, file.path);
      cursor += length;
      assert.equal(blobs[cursor++], 10);
      assert.equal(sha256(await fs.readFile(path.join(v1Root, file.path))), file.originalWorkingSha256, file.path);
    }
    assert.equal(cursor, blobs.length);
    blobs = null;
    console.log(`PASS: original Git objects and ${v1.files} exact working byte identities`);
    await node('v1-regressions', ['--test', '--test-reporter=tap'], v1Root);
    await node('v1-frozen-evidence', ['scripts/ci/verify-frozen.mjs', v1Root]);

    // prepareOldRC archives its existing fixed BASE; its verifier's evidence root stays Release 1.
    const v2 = JSON.parse(await node('v2-snapshot', ['--input-type=module', '-e',
      "import {prepareOldRC} from './tools/release1/prepare.mjs'; console.log(JSON.stringify(await prepareOldRC(process.argv[1])));", v2Root]));
    // Legacy policies also bind non-Benchmark evidence (for example USER_RULES.md).
    // Restore original working bytes only where the fixed v2 Git blob is still the v1 blob.
    const v2Tree = new Map(git('ls-tree', '-rz', v2Commit).toString().split('\0').filter(Boolean).map(line => {
      const tab = line.indexOf('\t');
      return [line.slice(tab + 1), line.slice(0, tab).split(' ')[2]];
    }));
    await restore(v2Root, inventory.files.filter(file => tree.get(file.path) === v2Tree.get(file.path)));
    const restoredV2 = await verifyVersion({ version: v2.version, root: v2Root });
    assert.ok(restoredV2.valid, restoredV2.errors.join('\n'));
    await fs.symlink(path.join(evidenceRoot, 'node_modules'), path.join(v2Root, 'node_modules'),
      process.platform === 'win32' ? 'junction' : 'dir');
    await node('v2-regressions', ['--test', '--test-reporter=tap'], v2Root);
    await node('release1-regressions', ['--test', '--test-reporter=tap']);
    const acceptance = {};
    for (const [name, implementationRoot] of [['v2', v2Root], ['release1', evidenceRoot]]) {
      const output = path.join(temporary, `${name}-acceptance`);
      await fs.mkdir(output);
      for (const file of ['input-lateral.json', 'input-propagation-controls.json']) {
        await fs.copyFile(path.join(evidenceRoot, 'tests/fixtures/physics-v2', file), path.join(output, file));
      }
      await node(`${name}-acceptance`, ['tests/tools/validatePhysicsV2.mjs', output, v1Root], implementationRoot);
      acceptance[name] = (await json(path.join(output, 'acceptance.json'))).summary;
    }
    // Original negative matrices run above. Also prove these distinct historical implementations
    // cannot be substituted for one another at the trusted verifier boundary.
    assert.equal((await verifyVersion({ version: v2.version, root: evidenceRoot })).valid, false);
    assert.equal((await verifyRelease({ root: v2Root })).valid, false);
    assert.equal((await verifyVersion({ version: v1.identity.version, root: v2Root })).valid, false);
    const result = { release1Commit: RELEASE1_COMMIT,
      release1Tree: git('rev-parse', `${RELEASE1_COMMIT}^{tree}`).toString().trim(),
      v1Commit: inventory.commit, v1Tree: maintenance.tree, v2Commit, v2Tree: release.baselineTree,
      originalCommits: maintenance.commits.length, originalFiles: v1.files,
      v1: v1.identity, v2, release1: releaseIdentity, acceptance, phases };
    console.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    // Only our own mkdtemp child may be removed, including dependency junctions, never their targets.
    assert.equal(path.dirname(temporary), path.resolve(os.tmpdir()));
    assert.ok(path.basename(temporary).startsWith('shapez2-history-'));
    await fs.rm(temporary, { recursive: true, force: true });
    console.log(`CLEANED: ${temporary}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length !== 2) {
    console.error('Usage: node scripts/ci/verify-history.mjs (run from a repository with the fixed historical Git objects)');
    process.exitCode = 1;
  } else {
    try { await verifyHistory(); }
    catch (error) { console.error(error.stack); process.exitCode = 1; }
  }
}
