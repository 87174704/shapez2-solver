// Explicit network operation; builds themselves use only the reviewed lock file.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import postcss from 'postcss';
import { dependencies, FONT_CSS } from './profiles.mjs';
import { ROOT, request, sha, writeJson } from './shared.mjs';
const records = [];
await fs.mkdir(path.join(ROOT, '.f1/downloads'), { recursive: true });
try {
  for (const d of dependencies) {
    const baseline = await request(d.global); records.push({ dependency: d.name, profile: 'global', ...baseline.record });
    assert.match(baseline.record.contentType, /javascript/);
    await fs.writeFile(path.join(ROOT, `.f1/downloads/${d.name}.js`), baseline.bytes);
    const mirror = await request(d.china); records.push({ dependency: d.name, profile: 'china', ...mirror.record, equalToGlobal: sha(mirror.bytes) === sha(baseline.bytes) });
    assert.match(mirror.record.contentType, /javascript/);
    assert.equal(mirror.record.acao, '*', `Anonymous CORS required: ${d.china}`);
    assert.equal(baseline.record.acao, '*', `Anonymous CORS required: ${d.global}`);
    assert.deepEqual(mirror.bytes, baseline.bytes, `Mirror bytes differ: ${d.name}`);
    // Verify published package identity and preserve the actual upstream license.
    const metadata = await request(`https://cdn.jsdelivr.net/npm/${d.name}@${d.version}/package.json`);
    const pkg = JSON.parse(metadata.bytes); assert.equal(pkg.version, d.version); assert.equal(pkg.name, d.name);
    records.push({ dependency: d.name, role: 'package-metadata', declaredLicense: pkg.license, ...metadata.record });
    const license = await request(`https://cdn.jsdelivr.net/npm/${d.name}@${d.version}/${d.licenseFile}`);
    records.push({ dependency: d.name, role: 'license', ...license.record });
    await fs.writeFile(path.join(ROOT, `.f1/downloads/${d.name}-LICENSE`), license.bytes);
    console.log(`VERIFIED ${d.name}@${d.version}: identical bytes, HTTPS, CORS`);
  }
  const css = await request(FONT_CSS); records.push({ role: 'font-css', ...css.record });
  await fs.writeFile(path.join(ROOT, '.f1/downloads/barlow-google.css'), css.bytes);
  const urls = new Set();
  postcss.parse(css.bytes.toString()).walkDecls('src', decl => { for (const m of decl.value.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)) urls.add(m[1]); });
  assert.ok(urls.size >= 18, 'All original weights/styles required');
  for (const [i, url] of [...urls].entries()) {
    const font = await request(url); assert.equal(font.record.acao, '*');
    assert.ok(font.bytes.subarray(0, 4).equals(Buffer.from('wOF2')), 'Expected WOFF2');
    records.push({ role: 'font', localFile: `barlow-${i}.woff2`, ...font.record });
    await fs.writeFile(path.join(ROOT, `.f1/downloads/barlow-${i}.woff2`), font.bytes);
  }
  // Pin the licensing source to a Git commit, not a mutable branch.
  const head = await request('https://api.github.com/repos/google/fonts/commits?path=ofl/barlow&per_page=1');
  const commit = JSON.parse(head.bytes)[0].sha;
  const license = await request(`https://cdn.jsdelivr.net/gh/google/fonts@${commit}/ofl/barlow/OFL.txt`);
  records.push({ role: 'font-license', commit, ...license.record });
  assert.match(license.bytes.toString(), /SIL OPEN FONT LICENSE/);
  await fs.writeFile(path.join(ROOT, '.f1/downloads/Barlow-OFL.txt'), license.bytes);
  await writeJson('.f1/evidence/cdn-probe.json', { status: 'VERIFIED from this host only; mainland routing UNKNOWN', records });
  console.log(`VERIFIED Barlow snapshot: ${urls.size} WOFF2 files, OFL from ${commit}`);
} catch (error) {
  await writeJson('.f1/evidence/cdn-probe.json', { status: 'BLOCKED', error: error.message, failed: error.record, records });
  throw error;
}
