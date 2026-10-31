import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { TRANSLATIONS } from '../../i18n.js';
import { SUPPORTED_LOCALES } from '../../localeConfig.js';
const out = new URL('../../docs/release1/i18n/', import.meta.url);
await fs.mkdir(out, { recursive: true });
const keys = Object.keys(TRANSLATIONS.en).sort();
const placeholders = value => typeof value === 'function'
    ? value.toString().match(/\(\{([^}]+)\}\)/)[1].split(',').map(p => p.trim()).sort()
    : [...new Set([...value.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map(m => m[1]))].sort();
const coverage = SUPPORTED_LOCALES.map(locale => {
    const d = TRANSLATIONS[locale];
    const missing = keys.filter(k => !Object.hasOwn(d, k) || !d[k]);
    const extra = Object.keys(d).filter(k => !keys.includes(k));
    const parameterMismatches = keys.filter(k => JSON.stringify(placeholders(d[k] ?? '')) !== JSON.stringify(placeholders(TRANSLATIONS.en[k])));
    return { locale, keys: Object.keys(d).length, missing, extra, parameterMismatches,
        translationReview: ['en', 'zh-CN'].includes(locale) ? '163 existing messages retained; 7 new messages AI-assisted, native review pending' : 'AI-assisted initial translation; native review pending' };
});
const evidence = { status: coverage.every(r => !r.missing.length && !r.extra.length && !r.parameterMismatches.length) ? 'PASS' : 'FAIL', locales: SUPPORTED_LOCALES, keyCount: keys.length, totalEntries: SUPPORTED_LOCALES.length * keys.length, coverage };
await fs.writeFile(new URL('COVERAGE.json', out), JSON.stringify(evidence, null, 2) + '\n');
const terms = keys.filter(k => /^(operations\.(?!short|label)|colors\.|modal.extraction\.(layer|shape|color|part)$|settings\.(depthLimit|maxLayers)$)/.test(k));
const csv = v => '"' + String(v).replaceAll('"', '""') + '"';
await fs.writeFile(new URL('GLOSSARY.csv', out), '\uFEFF' + [['key', ...SUPPORTED_LOCALES], ...terms.map(k => [k, ...SUPPORTED_LOCALES.map(l => TRANSLATIONS[l][k])])].map(row => row.map(csv).join(',')).join('\n') + '\n');
const baseline = JSON.parse(execFileSync('git', ['show', '465e66a:versions/shapez2-solver-release1.json'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));
const allowed = new Set(['main.js', 'i18n.js', 'operationGraph.js', 'styles.css', 'index.html', 'cn/index.html', 'en/index.html']);
const protectedFiles = [...new Map([...baseline.semantics.files, ...baseline.runtime.files.filter(f => !allowed.has(f.path))].map(f => [f.path, f])).values()];
const hashes = [];
for (const f of protectedFiles) {
    const actual = createHash('sha256').update(await fs.readFile(new URL('../../' + f.path, import.meta.url))).digest('hex');
    if (actual !== f.sha256) throw Error(`Protected baseline file changed: ${f.path}`);
    hashes.push({ path: f.path, sha256: actual });
}
await fs.writeFile(new URL('evidence/protected-source.json', out), JSON.stringify({ baselineCommit: '465e66a00613a301fd3fb106af1fce927d6efc61', status: 'PASS', checked: hashes.length, files: hashes }, null, 2) + '\n');
console.log(JSON.stringify({ status: evidence.status, locales: coverage.length, keys: keys.length, entries: evidence.totalEntries, protectedFiles: hashes.length }));
if (evidence.status !== 'PASS') process.exitCode = 1;
