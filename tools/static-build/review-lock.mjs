// Maintainer-only: import already inspected probe evidence. Never called by build.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import postcss from 'postcss';
import { dependencies, FONT_CSS } from './profiles.mjs';
import { ROOT, readJson, sha, writeJson } from './shared.mjs';
const probe = await readJson('.f1/evidence/cdn-probe.json');
assert.ok(probe.status.startsWith('VERIFIED'));
const deps = [];
await fs.mkdir(path.join(ROOT, 'third-party/licenses'), { recursive: true });
await fs.mkdir(path.join(ROOT, 'third-party/barlow'), { recursive: true });
for (const d of dependencies) {
  const global = probe.records.find(r => r.profile === 'global' && r.dependency === d.name);
  const china = probe.records.find(r => r.profile === 'china' && r.dependency === d.name);
  assert.equal(global.url, d.global); assert.equal(china.url, d.china);
  assert.equal(global.sha256, china.sha256); assert.equal(china.equalToGlobal, true);
  const license = await fs.readFile(path.join(ROOT, `.f1/downloads/${d.name}-LICENSE`));
  const lic = probe.records.find(r => r.role === 'license' && r.dependency === d.name);
  assert.equal(sha(license), lic.sha256);
  await fs.writeFile(path.join(ROOT, `third-party/licenses/${d.name}-LICENSE`), license);
  deps.push({ ...d, sha256: global.sha256, integrity: global.integrity, bytes: global.bytes, licenseUrl: lic.url, licenseSha256: lic.sha256,
    generatedByCdn: d.name === 'cytoscape-elk' });
}
const css = await fs.readFile(path.join(ROOT, '.f1/downloads/barlow-google.css'));
const cssRecord = probe.records.find(r => r.role === 'font-css'); assert.equal(sha(css), cssRecord.sha256);
const tree = postcss.parse(css.toString());
const fontRecords = probe.records.filter(r => r.role === 'font');
const fonts = [];
for (const f of fontRecords) {
  const bytes = await fs.readFile(path.join(ROOT, '.f1/downloads', f.localFile)); assert.equal(sha(bytes), f.sha256);
  await fs.writeFile(path.join(ROOT, 'third-party/barlow', f.localFile), bytes);
  fonts.push({ url: f.url, localFile: f.localFile, sha256: f.sha256, bytes: f.bytes });
}
tree.walkDecls('src', decl => {
  const match = /^url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\) format\('woff2'\)$/.exec(decl.value);
  assert.ok(match, `Unexpected font source grammar: ${decl.value}`);
  const font = fonts.find(f => f.url === match[1]); assert.ok(font);
  decl.value = `url('./${font.localFile}') format('woff2')`;
});
const localCss = tree.toString();
await fs.writeFile(path.join(ROOT, 'third-party/barlow/barlow.css'), localCss);
const license = await fs.readFile(path.join(ROOT, '.f1/downloads/Barlow-OFL.txt'));
const fontLicense = probe.records.find(r => r.role === 'font-license'); assert.equal(sha(license), fontLicense.sha256);
await fs.writeFile(path.join(ROOT, 'third-party/barlow/OFL.txt'), license);
await writeJson('tools/static-build/resources.lock.json', { schemaVersion: 1, dependencies: deps,
  font: { family: 'Barlow', distributionVersion: 'Google Fonts s/barlow/v13', styles: ['normal', 'italic'], weights: [100,200,300,400,500,600,700,800,900],
    globalCss: FONT_CSS, snapshotCssSha256: sha(css), localCssSha256: sha(localCss), license: 'OFL-1.1', licenseUrl: fontLicense.url, licenseCommit: fontLicense.commit, licenseSha256: fontLicense.sha256, fonts } });
console.log(`Locked ${deps.length} scripts and ${fonts.length} font files.`);
