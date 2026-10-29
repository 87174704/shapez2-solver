import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { parse } from 'acorn';
import postcss from 'postcss';
import { ROOT, sha, sri, readJson, writeJson, filesUnder, git } from './shared.mjs';
import { profiles, RC_COMMIT } from './profiles.mjs';
import { parseHtml, elements, attr, textContent } from './html.mjs';
import { verifyVersion } from '../../versions/identity.mjs';
import { serve } from './serve.mjs';
const results = { status: 'VERIFIED', profiles: {}, differences: [], originalSourceChanges: [] };
const lock = await readJson('tools/static-build/resources.lock.json');
for (const file of (await filesUnder(path.join(ROOT,'tools/static-build'),{ignoreDirs:['node_modules']})).filter(f=>f.endsWith('.mjs'))) parse(await fs.readFile(path.join(ROOT,'tools/static-build',file),'utf8'),{ecmaVersion:'latest',sourceType:'module'});
const digestTree = async dir => Object.fromEntries(await Promise.all((await filesUnder(dir)).map(async f => [f, sha(await fs.readFile(path.join(dir, f)))])));
for (const [name, cfg] of Object.entries(profiles)) {
  // These are small static copies (~2 MB), not solver execution or a large compilation.
  const build = () => execFileSync(process.execPath, [path.join(ROOT, 'tools/static-build/build.mjs'), name], { cwd: ROOT, encoding: 'utf8' });
  build(); const dir = path.join(ROOT, 'dist', name), first = await digestTree(dir); build();
  assert.deepEqual(await digestTree(dir), first, `${name} reproducibility`);
  const m = await readJson(`dist/${name}/build-manifest.json`);
  const allowedRemote = new Set([...cfg.scriptOrigins, ...cfg.styleOrigins, ...cfg.fontOrigins]);
  let htmlCount = 0, jsCount = 0, cssCount = 0, localReferences = 0;
  const localPath = (ref, base) => {
    if (/^(data:|#)/.test(ref)) return;
    const u = new URL(ref, base);
    if (u.origin !== 'https://validation.invalid') { assert.ok(allowedRemote.has(u.origin), `Unexpected network dependency: ${u.href}`); return; }
    assert.ok(u.pathname.startsWith(m.basePath), `Escapes site base: ${u.pathname}`);
    const target = decodeURIComponent(u.pathname.slice(m.basePath.length)) || 'index.html';
    assert.ok(first[target], `Missing local resource ${target}`); localReferences++;
  };
  for (const file of Object.keys(first)) {
    const bytes = await fs.readFile(path.join(dir, file));
    assert.doesNotMatch(bytes.toString('utf8'), /(?:E:\\solver|E:\/solver|C:\\Users\\|-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY-----)/i, file);
    if (file.endsWith('.html')) {
      htmlCount++; const nodes = elements(parseHtml(bytes.toString(), file));
      const base = attr(nodes.find(n => n.tagName === 'base'), 'href'); assert.equal(base, m.basePath);
      const externalScripts = nodes.filter(n => n.tagName === 'script' && /^https:/.test(attr(n, 'src') ?? ''));
      assert.deepEqual(externalScripts.map(n => attr(n, 'src')), lock.dependencies.map(d => d[name]));
      for (const [i, n] of externalScripts.entries()) { assert.equal(attr(n, 'integrity'), lock.dependencies[i].integrity); assert.equal(attr(n, 'crossorigin'), 'anonymous'); assert.equal(attr(n, 'type'), undefined); assert.equal(attr(n, 'async'), undefined); assert.equal(attr(n, 'defer'), undefined); }
      const csp = attr(nodes.find(n => attr(n, 'http-equiv') === 'Content-Security-Policy'), 'content');
      assert.ok(csp && !csp.includes('*') && !csp.includes('script-src \'unsafe-inline\''));
      for (const n of nodes) {
        if (n.tagName === 'script' && !attr(n, 'src')) {
          parse(textContent(n), { ecmaVersion: 'latest' }); assert.ok(csp.includes(sri(Buffer.from(textContent(n)))));
        }
        // Hyperlinks are navigations, not automatic remote network dependencies.
        for (const key of n.tagName === 'a' || n.tagName === 'base' ? [] : ['src', 'href']) { const ref = attr(n, key); if (ref) localPath(ref, `https://validation.invalid${m.basePath}`); }
        if (attr(n, 'style')) postcss.parse(`x { ${attr(n, 'style')} }`);
        assert.ok(!(n.attrs ?? []).some(a => a.name.startsWith('on')), 'Inline event handler requires a separate CSP policy');
      }
    }
    if (file.endsWith('.css')) {
      cssCount++; const css = postcss.parse(bytes.toString());
      for (const match of bytes.toString().matchAll(/url\((?:['"])?([^)'"\s]+)(?:['"])?\)/g)) localPath(match[1], `https://validation.invalid${m.basePath}${file}`);
      if (file === 'assets/fonts/barlow.css') {
        const faces = []; css.walkAtRules('font-face', rule => { const face = Object.fromEntries(rule.nodes.filter(n => n.type === 'decl').map(n => [n.prop, n.value])); faces.push(face); assert.equal(face['font-display'], 'swap'); });
        assert.equal(faces.length, 54);
        for (const style of lock.font.styles) for (const weight of lock.font.weights) assert.ok(faces.some(f => f['font-style'] === style && f['font-weight'] === String(weight)));
      }
    }
    if (file.endsWith('.js')) {
      jsCount++; const ast = parse(bytes.toString(), { ecmaVersion: 'latest', sourceType: 'module' });
      const walk = node => {
        if (!node || typeof node !== 'object') return;
        if (['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type) && node.source) localPath(node.source.value, `https://validation.invalid${m.basePath}${file}`);
        if (node.type === 'ImportExpression') { assert.equal(node.source.type, 'Literal', 'Dynamic import must be statically audited'); localPath(node.source.value, `https://validation.invalid${m.basePath}${file}`); }
        if (node.type === 'NewExpression' && node.callee.name === 'URL' && node.arguments[0].type === 'Literal') localPath(node.arguments[0].value, `https://validation.invalid${m.basePath}${file}`);
        for (const v of Object.values(node)) if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') walk(v);
      }; walk(ast);
    }
  }
  for (const f of m.files) { assert.equal(first[f.path], f.sha256, 'Manifest hash ' + f.path); assert.equal((await fs.stat(path.join(dir, f.path))).size, f.bytes); }
  assert.equal(Object.keys(first).length, m.files.length + 1, 'No unlisted artifact files');
  const host=await serve(name);let httpChecks=0;
  try {
    for(const file of ['index.html','cn/','en/','en/index.html','main.js','shapeSolver.js','mixingSolver.js','operationGraph.js','images/operations/half-destroyer.png',...(name==='china'?['assets/fonts/barlow.css','assets/fonts/barlow-0.woff2']:[])]){
      const response=await fetch(host.url+file);assert.equal(response.status,200,`${name} HTTP ${file}`);
      const bytes=Buffer.from(await response.arrayBuffer());const diskFile=file.endsWith('/')?file+'index.html':file;assert.equal(sha(bytes),first[diskFile]);httpChecks++;
    }
    const noSlash=await fetch(host.url+'cn',{redirect:'manual'});assert.equal(noSlash.status,301);assert.equal(noSlash.headers.get('location'),m.basePath+'cn/');httpChecks++;
    if(name==='global'){assert.equal((await fetch(new URL('/main.js',host.url))).status,404);httpChecks++;}
  }finally{await host.close();}
  results.profiles[name] = { reproducible: true, fileCount: Object.keys(first).length, htmlCount, jsCount, cssCount, localReferences, httpChecks, manifestSha256: first['build-manifest.json'] };
}
const a = await digestTree(path.join(ROOT, 'dist/global')), b = await digestTree(path.join(ROOT, 'dist/china'));
for (const file of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
  if (a[file] === b[file]) continue;
  let reason;
  if (['index.html','cn/index.html','en/index.html'].includes(file)) reason = 'CDN URLs, profile CSP and configured base path; SRI/order and application markup identical';
  else if (file === 'styles.css') reason = 'Only Barlow @import source differs';
  else if (file.startsWith('assets/fonts/')) reason = 'China-only licensed local Barlow font snapshot';
  else if (file === 'build-manifest.json') reason = 'Profile, base path, font/CDN configuration and artifact digests';
  else throw Error(`Unauthorized profile difference: ${file}`);
  results.differences.push({ file, globalSha256: a[file] ?? null, chinaSha256: b[file] ?? null, reason });
}
// Check structural equality after removing exactly the authorized configuration fields.
for (const file of ['index.html','cn/index.html','en/index.html']) {
  const normalize = async name => { const doc = parseHtml(await fs.readFile(path.join(ROOT,'dist',name,file),'utf8')); for (const n of elements(doc)) { if (n.tagName === 'base') n.attrs = []; if (attr(n,'http-equiv') === 'Content-Security-Policy') n.attrs = []; if (n.tagName === 'script' && /^https:/.test(attr(n,'src') ?? '')) n.attrs = n.attrs.filter(a => a.name !== 'src'); } const clean = n => ({ nodeName:n.nodeName, tagName:n.tagName, attrs:n.attrs, value:n.value, childNodes:n.childNodes?.map(clean) });return clean(doc); };
  assert.deepEqual(await normalize('global'), await normalize('china'), file);
}
const css = async n => { const r=postcss.parse(await fs.readFile(path.join(ROOT,'dist',n,'styles.css'),'utf8'));r.walkAtRules('import',d=>d.remove());return r.toString(); };
assert.equal(await css('global'), await css('china'));
const identity = await verifyVersion({version:'shape-operations-v2-support-closure'}); assert.ok(identity.valid,identity.errors.join('\n')); results.identity=identity;
const rcPaths = new Set(git('ls-tree','-r','--name-only',RC_COMMIT).split('\n'));
const changed = git('diff','--name-only',RC_COMMIT).split('\n').filter(f=>rcPaths.has(f)); assert.deepEqual(changed, [], 'Original RC tracked files changed');
results.originalSourceChanges=changed;
results.sharedApplicationFiles = Object.keys(a).filter(f => f.endsWith('.js') && a[f] === b[f]).length;
await writeJson('.f1/evidence/static-validation.json', results);
console.log(JSON.stringify({ status: results.status, profiles: results.profiles, sharedApplicationFiles: results.sharedApplicationFiles, explainedDifferences: results.differences.length, frozenFiles:identity.frozenFilesChecked }, null, 2));
