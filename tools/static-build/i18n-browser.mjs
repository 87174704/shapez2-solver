import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { ROOT, sha, writeJson, readJson } from './shared.mjs';
import { serve } from './serve.mjs';
import { SUPPORTED_LOCALES, LANGUAGE_NAMES } from '../../localeConfig.js';
import { replaySolution } from '../../tests/helpers/shapeSolverOracle.mjs';

const out = 'docs/release1/i18n/evidence';
await fs.mkdir(path.join(ROOT, out), { recursive: true });
const candidates = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'];
let executablePath;
for (const p of candidates) try { await fs.access(p); executablePath = p; break; } catch {}
assert.ok(executablePath, 'Installed Chromium required');
const browser = await chromium.launch({ executablePath, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = { browser: browser.version(), profiles: [], automation: 'Real installed browser; native CDN requests, no network interception' };

async function snapshot(page) {
    return page.evaluate(async () => {
        const { getCyInstance } = await import(new URL('operationGraph.js', document.baseURI));
        const cy = getCyInstance();
        return {
            shapes: [...document.querySelectorAll('.shape-item')].map(e => e.dataset.shapeCode),
            inputs: [...document.querySelectorAll('input')].map(e => [e.id, e.type, e.value, e.checked]),
            operations: [...document.querySelectorAll('.operation-item')].map(e => [e.dataset.operation, e.classList.contains('enabled')]),
            view: cy ? { zoom: cy.zoom(), pan: cy.pan(), nodes: cy.nodes().map(n => ({ id: n.id(), position: n.position() })), edges: cy.edges().map(e => [e.source().id(), e.target().id()]) } : null,
            workerLog: window.__workerLog,
        };
    });
}

try {
    for (const profile of ['global', 'china']) {
        const host = await serve(profile);
        const row = { profile, basePath: host.manifest.basePath, sourceCommit: host.manifest.sourceCommit, sourceTree: host.manifest.sourceTree, checks: [], locales: [], errors: [], csp: [], failedRequests: [] };
        report.profiles.push(row);
        const context = await browser.newContext({ locale: 'en-GB', viewport: { width: 1440, height: 1000 } });
        await context.exposeBinding('__reportCsp', (_, violation) => row.csp.push(violation));
        await context.addInitScript(() => {
            window.__workerLog = [];
            const Original = window.Worker;
            window.Worker = class extends Original {
                constructor(...args) {
                    super(...args);
                    window.__workerLog.push({ event: 'create', url: String(args[0]) });
                    this.addEventListener('message', e => window.__workerLog.push({ event: 'received', data: structuredClone(e.data) }));
                }
                postMessage(...args) { window.__workerLog.push({ event: 'sent', data: structuredClone(args[0]) }); return super.postMessage(...args); }
                terminate() { window.__workerLog.push({ event: 'terminate' }); return super.terminate(); }
            };
            document.addEventListener('securitypolicyviolation', e => window.__reportCsp({ directive: e.violatedDirective, uri: e.blockedURI }));
        });
        const page = await context.newPage();
        page.setDefaultTimeout(25000);
        page.on('pageerror', e => row.errors.push(e.message));
        page.on('requestfailed', r => row.failedRequests.push({ url: r.url(), error: r.failure()?.errorText }));
        try {
            await page.goto(host.url + '?test=i18n#graph', { waitUntil: 'networkidle' });
            await page.waitForFunction(() => document.querySelector('#lang-preference')?.options.length === 13);
            assert.equal(await page.locator('#lang-preference').inputValue(), 'en');
            assert.equal(new URL(page.url()).search, '?test=i18n');
            assert.equal(new URL(page.url()).hash, '#graph');
            assert.deepEqual(await page.locator('#lang-preference option').evaluateAll(es => es.map(e => [e.value, e.textContent])), Object.entries(LANGUAGE_NAMES));
            row.checks.push('English default; identical native-name menu; prefix/query/hash retained');

            await page.fill('#target-input', 'CuCu----');
            await page.click('#add-target-shape-btn');
            await page.locator('.operation-item.enabled').evaluateAll(es => es.forEach(e => { if (e.dataset.operation !== 'Half Destroyer') e.click(); }));
            await page.click('#panel-solver .btn-primary');
            await page.waitForFunction(() => document.querySelector('#status-dot').classList.contains('done'));
            await page.fill('#target-input', 'RuRuRuRu:CuCuCuCu');
            await page.fill('#max-states-per-level', '250');
            await page.selectOption('#direction-select', 'TB');
            // The direction control intentionally animates for 500ms; settle it before
            // measuring changes caused by a language switch.
            await page.waitForTimeout(650);
            await page.evaluate(async () => { const { getCyInstance } = await import(new URL('operationGraph.js', document.baseURI)); const cy = getCyInstance(); cy.zoom(0.8); cy.pan({ x: 145, y: 120 }); window.__cyBefore = cy; });
            const before = await snapshot(page);
            const cdp = await context.newCDPSession(page);
            await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
            for (const locale of SUPPORTED_LOCALES) {
                await page.selectOption('#lang-preference', locale);
                assert.deepEqual(await snapshot(page), before, `${profile}:${locale}: UI state/Worker traffic/graph view changed`);
                assert.equal(await page.evaluate(async () => (await import(new URL('operationGraph.js', document.baseURI))).getCyInstance() === window.__cyBefore), true);
                assert.equal(await page.getAttribute('html', 'lang'), locale);
                assert.equal(await page.evaluate(() => localStorage.getItem('shapez2-solver-locale')), locale);
                const visible = await page.evaluate(async () => {
                    const { t } = await import(new URL('i18n.js', document.baseURI));
                    const issues = [];
                    for (const e of document.querySelectorAll('[data-i18n]')) {
                        if (e.id !== 'status-text' && e.textContent !== t(e.dataset.i18n)) issues.push(e.dataset.i18n);
                    }
                    return { issues, status: document.querySelector('#status-text').textContent, title: document.title,
                        operationLabels: [...document.querySelectorAll('.operation-item')].map(e => e.getAttribute('aria-label')) };
                });
                assert.deepEqual(visible.issues, []);
                assert.ok(visible.operationLabels.every(Boolean));
                const { root } = await cdp.send('DOM.getDocument');
                const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-i18n="sections.settings"]' });
                const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
                assert.ok(fonts.some(f => f.glyphCount > 0), locale + ': no rendered glyphs');
                row.locales.push({ locale, ...visible, fonts });
            }
            row.checks.push('13 manual selections preserve input drafts, resource inventory, configuration, Worker messages, result path, graph instance, topology and viewport');

            // Invalid shape errors use translated validation messages, keeping the raw code intact.
            await page.fill('#target-input', 'Zr------');
            row.validationDialogs = [];
            for (const locale of SUPPORTED_LOCALES) {
                await page.selectOption('#lang-preference', locale);
                const expected = await page.evaluate(async () => {
                    const { t } = await import(new URL('i18n.js', document.baseURI));
                    return t('validation.invalidShape', { layerNumber: 1, partNumber: 1, shape: 'Z' });
                });
                const dialogPromise = page.waitForEvent('dialog');
                const click = page.click('#add-target-shape-btn');
                const dialog = await dialogPromise;
                assert.ok(dialog.message().includes(expected));
                assert.ok(dialog.message().includes('Zr------'));
                row.validationDialogs.push({ locale, message: dialog.message() });
                await dialog.dismiss(); await click;
            }
            await page.fill('#target-input', 'RuRuRuRu:CuCuCuCu');

            const busyPage = await context.newPage();
            await busyPage.goto(host.url, { waitUntil: 'networkidle' });
            await busyPage.fill('#target-input', 'CuCu----'); await busyPage.click('#add-target-shape-btn');
            const active = await busyPage.evaluate(() => {
                document.querySelector('#panel-solver .btn-primary').click();
                const before = structuredClone(window.__workerLog);
                const select = document.querySelector('#lang-preference'); select.value = 'ja'; select.dispatchEvent(new Event('change'));
                return { before, after: structuredClone(window.__workerLog), status: document.querySelector('#status-text').textContent };
            });
            assert.deepEqual(active.after, active.before);
            assert.equal(active.before.filter(e => e.event === 'create').length, 1);
            assert.equal(active.before.filter(e => e.event === 'sent').length, 1);
            assert.equal(active.before.filter(e => e.event === 'terminate').length, 0);
            await busyPage.waitForFunction(() => document.querySelector('#status-dot').classList.contains('done'));
            await busyPage.close();
            row.activeWorkerSwitch = active;
            row.checks.push('Translated validation dialogs in 13 languages; active Solver continues through a language switch');

            // Compare actual Worker results under every locale, independently replay each path.
            const input = before.workerLog.find(e => e.event === 'sent').data.data;
            let firstPath;
            row.workerParity = [];
            for (const locale of SUPPORTED_LOCALES) {
                await page.selectOption('#lang-preference', locale);
                const result = await page.evaluate(async input => new Promise((resolve, reject) => {
                    const worker = new Worker(new URL('shapeSolver.js', document.baseURI), { type: 'module' });
                    const timer = setTimeout(() => { worker.terminate(); reject(Error('Worker timeout')); }, 15000);
                    worker.onmessage = e => { if (e.data.type === 'result') { clearTimeout(timer); worker.terminate(); resolve(e.data.result); } };
                    worker.onerror = e => { clearTimeout(timer); worker.terminate(); reject(Error(e.message)); };
                    worker.postMessage({ action: 'solve', data: input });
                }), input);
                firstPath ??= result.solutionPath;
                assert.deepEqual(result.solutionPath, firstPath);
                assert.equal(replaySolution(input, result.solutionPath, result).valid, true);
                row.workerParity.push({ locale, pathSha256: sha(JSON.stringify(result.solutionPath)), replayValid: true });
            }

            await page.click('.mode-tab[data-mode="explorer"]');
            await page.fill('#depth-limit-input', '1');
            await page.click('#panel-explorer .btn-primary');
            await page.waitForFunction(() => document.querySelector('#status-dot').classList.contains('done'));
            await page.locator('#graph-container canvas').waitFor({ state: 'visible' });
            const webgl = await page.locator('#graph-container canvas').evaluate(c => ({ width: c.width, height: c.height, webgl: !!(c.getContext('webgl2') || c.getContext('webgl')) }));
            assert.ok(webgl.webgl && webgl.width > 0 && webgl.height > 0);
            await page.evaluate(() => { window.__canvasBefore = document.querySelector('#graph-container canvas'); });
            const explorerLog = await page.evaluate(() => window.__workerLog);
            for (const locale of SUPPORTED_LOCALES) {
                await page.selectOption('#lang-preference', locale);
                assert.equal(await page.evaluate(() => window.__canvasBefore === document.querySelector('#graph-container canvas')), true);
                assert.deepEqual(await page.evaluate(() => window.__workerLog), explorerLog);
            }
            await page.screenshot({ path: path.join(ROOT, out, `${profile}-3d-th.png`), fullPage: true });
            row.checks.push('All 13 languages retain the actual 3D WebGL canvas and Explorer result without a new task');

            await page.click('.sidebar-tab[data-panel="mixing"]');
            await page.click('#mix-manual-inputs + .toggle-track');
            await page.fill('.mix-color-row[data-color="red"] .mix-have', '1');
            await page.fill('.mix-color-row[data-color="green"] .mix-have', '1');
            await page.fill('.mix-color-row[data-color="yellow"] .mix-want', '2');
            await page.click('#solve-mix');
            await page.waitForFunction(() => document.querySelector('#status-dot').classList.contains('done'));
            assert.ok(await page.locator('.mix-solution-item').count());
            const mixBefore = await snapshot(page);
            for (const locale of SUPPORTED_LOCALES) {
                await page.selectOption('#lang-preference', locale);
                assert.deepEqual(await snapshot(page), mixBefore);
            }
            row.checks.push('All 13 languages retain Mixing results, inventory and selection with no new Worker traffic');

            for (const locale of ['de', 'fr', 'zh-CN', 'zh-TW', 'ja', 'ko', 'th']) {
                await page.setViewportSize({ width: 390, height: 844 });
                await page.selectOption('#lang-preference', locale);
                for (const selector of ['#lang-preference', '#direction-select', '#color-mode-select']) {
                    const rect = await page.locator(selector).boundingBox();
                    assert.ok(rect && rect.x >= 0 && rect.x + rect.width <= 391 && rect.y + rect.height <= 845, `${locale} ${selector}: clipped ${JSON.stringify(rect)}`);
                }
                assert.equal(await page.locator('.mix-col-headers span').evaluateAll(es => es.every(e => e.scrollWidth <= e.clientWidth)), true, `${locale}: mixing headers overflow`);
                await page.screenshot({ path: path.join(ROOT, out, `${profile}-narrow-${locale}.png`), fullPage: true });
            }
            row.checks.push('390px viewport: long French/German labels and Chinese/Japanese/Korean/Thai controls remain reachable');
            await page.setViewportSize({ width: 1440, height: 1000 });

            await page.selectOption('#lang-preference', 'ja');
            await page.reload({ waitUntil: 'networkidle' });
            assert.equal(await page.locator('#lang-preference').inputValue(), 'ja');
            await page.evaluate(() => localStorage.setItem('shapez2-solver-locale', 'cn'));
            await page.goto(host.url + 'cn/index.html', { waitUntil: 'networkidle' });
            assert.equal(await page.locator('#lang-preference').inputValue(), 'zh-CN');
            assert.equal(await page.evaluate(() => localStorage.getItem('shapez2-solver-locale')), 'zh-CN');
            row.checks.push('Selection survives refresh; legacy cn storage and entry migrate to zh-CN');

            for (const [language, expected] of [['zh-HK', 'zh-TW'], ['pt-PT', 'pt-BR'], ['es-MX', 'es-ES'], ['ar-EG', 'en']]) {
                const detected = await browser.newContext({ locale: language });
                const p = await detected.newPage();
                await p.goto(host.url, { waitUntil: 'networkidle' });
                assert.equal(await p.locator('#lang-preference').inputValue(), expected);
                await detected.close();
            }
            const denied = await browser.newContext({ locale: 'fr-CA' });
            await denied.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw Error('denied'); } }));
            const deniedPage = await denied.newPage(); await deniedPage.goto(host.url, { waitUntil: 'networkidle' });
            assert.equal(await deniedPage.locator('#lang-preference').inputValue(), 'fr');
            await deniedPage.selectOption('#lang-preference', 'th');
            assert.equal(await deniedPage.getAttribute('html', 'lang'), 'th');
            await denied.close();
            row.checks.push('Real browser regional detection, unsupported-language fallback, and storage-denied selection');

            for (const locale of SUPPORTED_LOCALES) {
                const response = await page.goto(host.url + locale + '/index.html', { waitUntil: 'networkidle' });
                assert.equal(response.status(), 200);
                assert.equal(await page.locator('#lang-preference option').count(), 13);
            }
            row.checks.push('All 13 directory index entries load under the configured deployment prefix');
            assert.deepEqual(row.errors, []);
            assert.deepEqual(row.csp, []);
            assert.deepEqual(row.failedRequests, []);
            assert.deepEqual(host.requests.filter(r => r.status >= 400), []);
            row.status = 'PASS';
        } catch (error) {
            row.status = 'FAIL'; row.failure = error.stack;
            await page.screenshot({ path: path.join(ROOT, out, `${profile}-failure.png`), fullPage: true }).catch(() => {});
        } finally { await context.close(); await host.close(); }
        await writeJson(`${out}/browser.json`, report);
        console.log(`${profile}: ${row.status}${row.failure ? '\n' + row.failure : ''}`);
    }
} finally { await browser.close(); }
report.status = report.profiles.length === 2 && report.profiles.every(p => p.status === 'PASS') ? 'PASS' : 'FAIL';
await writeJson(`${out}/browser.json`, report);
if (report.status !== 'PASS') process.exitCode = 1;
