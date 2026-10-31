import { checkedDependencies } from './current-context.mjs';
import { verifyInstalledDependencies } from './current-dependencies.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const { default: postcss } = await import('postcss');
const { parse } = await import('acorn');
import { SUPPORTED_LOCALES } from '../../localeConfig.js';
import { verifyCurrentSource, selectedCommit, applicationFiles, sourceFiles, identityDigest } from '../../versions/current.mjs';
import { FONT_CSS, dependencies, profiles } from './profiles.mjs';
import { ROOT, sha, sri, git, readJson, writeJson, filesUnder } from './shared.mjs';
const { parseHtml, serialize, elements, attr, setAttr, tag, textContent } = await import('./html.mjs');
const name = process.argv[2], config = profiles[name]; assert.ok(config, 'Expected global or china profile');
const baseArg = process.argv.slice(3).find(a => a.startsWith('--base-path='));
const basePath = baseArg?.slice('--base-path='.length) ?? config.basePath;
assert.match(basePath, /^\/(?:[A-Za-z0-9_-]+\/)*$/, 'Base must be a safe absolute directory ending in /');
const commit = selectedCommit();
const identity = await verifyCurrentSource({ commit });
const lock = await readJson('tools/static-build/resources.lock.json'); assert.deepEqual(lock.dependencies.map(d => Object.fromEntries(Object.keys(dependencies[0]).map(k => [k,d[k]]))), dependencies);
const out = path.join(ROOT, 'dist', name);
// Computed deletion is restricted to one of two exact build output directories.
assert.ok(['global', 'china'].includes(name) && out === path.resolve(ROOT, 'dist', name));
await fs.rm(out, { recursive: true, force: true }); await fs.mkdir(out, { recursive: true });
const copy = async (from, to = from) => { await fs.mkdir(path.dirname(path.join(out, to)), { recursive: true }); await fs.copyFile(path.join(ROOT, from), path.join(out, to)); };
// Copy only site inputs; no checkout, cache, tests, credentials or absolute paths.
const appFiles = await applicationFiles({ commit });
for (const f of appFiles) await copy(f);
await copy('LICENSE');
await writeJson(`dist/${name}/release.json`, { schemaVersion: 1, release: 'shapez2-solver-maintenance',
  status: 'maintenance-candidate', physicsSemantics: identity.immutable.physicsSemantics,
  sourceCommit: identity.sourceCommit, sourceTree: identity.sourceTree, sourceIdentitySha256: identityDigest(identity),
  gameCertification: 'UNKNOWN' });
for (const f of sourceFiles({ commit }).filter(f => f.startsWith('docs/legal/') && !f.slice('docs/legal/'.length).startsWith('.'))) await copy(f);
await fs.writeFile(path.join(out, '.nojekyll'), '');
for (const d of lock.dependencies) {
  const lic = await fs.readFile(path.join(ROOT, `third-party/licenses/${d.name}-LICENSE`)); assert.equal(sha(lic), d.licenseSha256);
  await copy(`third-party/licenses/${d.name}-LICENSE`);
}
await copy('third-party/NOTICE.md');
assert.equal(sha(await fs.readFile(path.join(ROOT, 'third-party/barlow/OFL.txt'))), lock.font.licenseSha256);
await copy('third-party/barlow/OFL.txt');
if (name === 'china') {
  const css = await fs.readFile(path.join(ROOT, 'third-party/barlow/barlow.css')); assert.equal(sha(css), lock.font.localCssSha256);
  await copy('third-party/barlow/barlow.css', 'assets/fonts/barlow.css');
  for (const f of lock.font.fonts) { assert.equal(sha(await fs.readFile(path.join(ROOT, 'third-party/barlow', f.localFile))), f.sha256); await copy(`third-party/barlow/${f.localFile}`, `assets/fonts/${f.localFile}`); }
}
const stylesheet = postcss.parse(await fs.readFile(path.join(ROOT, 'styles.css'), 'utf8'));
const imports = []; stylesheet.walkAtRules('import', r => imports.push(r)); assert.equal(imports.length, 1);
assert.equal(imports[0].params, `url('${FONT_CSS}')`); imports[0].params = `url("${config.fontCss}")`;
await fs.writeFile(path.join(out, 'styles.css'), stylesheet.toString());
const source = await fs.readFile(path.join(ROOT, 'index.html'), 'utf8');
const scriptHashes = [];
for (const [locale, filename, lang] of [[null,'index.html','en'],['cn','cn/index.html','zh-CN'], ...SUPPORTED_LOCALES.map(locale => [locale, `${locale}/index.html`, locale])]) {
  const doc = parseHtml(source, 'index.html'), nodes = elements(doc);
  const head = nodes.find(n => n.tagName === 'head');
  setAttr(nodes.find(n => n.tagName === 'html'), 'lang', lang);
  const scripts = nodes.filter(n => n.tagName === 'script' && /^https:/.test(attr(n, 'src') ?? ''));
  assert.deepEqual(scripts.map(n => attr(n, 'src')), dependencies.map(d => d.global));
  scripts.forEach((node, i) => { setAttr(node, 'src', lock.dependencies[i][name]); setAttr(node, 'integrity', lock.dependencies[i].integrity); setAttr(node, 'crossorigin', 'anonymous'); });
  const inline = nodes.filter(n => n.tagName === 'script' && !attr(n, 'src'));
  assert.equal(inline.length, 1); parse(textContent(inline[0]), { ecmaVersion: 'latest' });
  const hash = sri(Buffer.from(textContent(inline[0]))); scriptHashes.push(hash);
  // The application keeps ForceGraph3D's d3 engine. Its bundled ngraph-only
  // Function constructors are not on that call path; do not permit unsafe-eval.
  const csp = ["default-src 'none'", `script-src 'self' '${hash}' ${config.scriptOrigins.join(' ')}`,
    `style-src 'self' 'unsafe-inline' ${config.styleOrigins.join(' ')}`.trim(),
    `font-src 'self' ${config.fontOrigins.join(' ')}`.trim(), "img-src 'self' data:", "connect-src 'self'", "worker-src 'self'", "child-src 'self'", "base-uri 'self'", "object-src 'none'", "form-action 'none'"].join('; ');
  // CSP follows charset and precedes any executable/resource element.
  const charset = head.childNodes.find(n => n.tagName === 'meta' && attr(n, 'charset'));
  const meta = tag('meta', { 'http-equiv': 'Content-Security-Policy', content: csp }); meta.parentNode = head;
  head.childNodes.splice(head.childNodes.indexOf(charset) + 1, 0, meta);
  const base = tag('base', { href: basePath }); base.parentNode = head;
  head.childNodes.splice(head.childNodes.indexOf(meta) + 1, 0, base);
  await fs.mkdir(path.dirname(path.join(out, filename)), { recursive: true });
  await fs.writeFile(path.join(out, filename), serialize(doc) + '\n');
}
const finalIdentity = await verifyCurrentSource({ commit });
assert.deepEqual(finalIdentity, identity, 'Source changed during build');
await verifyInstalledDependencies(ROOT, checkedDependencies);
const fileHashes = [];
for (const file of await filesUnder(out)) fileHashes.push({ path: file, bytes: (await fs.stat(path.join(out, file))).size, sha256: sha(await fs.readFile(path.join(out, file))) });
const buildTools = [];
for (const file of sourceFiles({ commit }).filter(f => f.startsWith('tools/static-build/') && /\.(mjs|json)$/.test(f))) buildTools.push({ path: file, sha256: sha(await fs.readFile(path.join(ROOT, file))) });
await writeJson(`dist/${name}/build-manifest.json`, { schemaVersion: 1, sourceCommit: identity.sourceCommit, sourceTree: identity.sourceTree, sourceIdentitySha256: identityDigest(identity),
  locales: SUPPORTED_LOCALES, trackedChanges: git('diff', '--name-only', 'HEAD'), profile: name, basePath, buildTool: 'shapez2-maintenance-static-build/1.0.0', node: process.version, toolingPackages: (await readJson('tools/static-build/package.json')).devDependencies,
  identity, checkedDependencies, buildTools, dependencies: lock.dependencies.map(d => ({ name: d.name, version: d.version, url: d[name], sha256: d.sha256, integrity: d.integrity, license: d.license, generatedByCdn: d.generatedByCdn })),
  font: name === 'global' ? { family: 'Barlow', css: config.fontCss, behavior: 'Google UA-dependent CSS; font-display swap, system sans fallback', snapshot: lock.font.distributionVersion } : { ...lock.font, css: config.fontCss },
  files: fileHashes });
console.log(`Built ${name}: ${fileHashes.length} files + deterministic manifest, base ${basePath}`);
