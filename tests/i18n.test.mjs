import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { TRANSLATIONS, t, getOperationDisplayName, getOperationLabel, getColorDisplayName,
    getLocalePath, getLocaleUrl, getLocaleFromPath, setCurrentLocale, setStoredLocale } from '../i18n.js';
import { SUPPORTED_LOCALES, LANGUAGE_NAMES, normalizeLocale, resolvePreferredLocale, getStoredLocale, getPreferredLocale } from '../localeConfig.js';

export function parameters(value) {
    if (typeof value === 'function') return value.toString().match(/\(\{([^}]+)\}\)/)[1].split(',').map(x => x.trim()).sort();
    return [...new Set([...value.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map(m => m[1]))].sort();
}

test('all 13 locales have exactly the same nonempty keys and parameters; every message renders', () => {
    const keys = Object.keys(TRANSLATIONS.en).sort();
    assert.equal(SUPPORTED_LOCALES.length, 13);
    assert.deepEqual(Object.keys(LANGUAGE_NAMES), SUPPORTED_LOCALES);
    assert.deepEqual(Object.keys(TRANSLATIONS).sort(), [...SUPPORTED_LOCALES].sort());
    for (const locale of SUPPORTED_LOCALES) {
        const dict = TRANSLATIONS[locale];
        assert.deepEqual(Object.keys(dict).sort(), keys, locale);
        for (const key of keys) {
            assert.ok(dict[key], `${locale}:${key}`);
            assert.deepEqual(parameters(dict[key]), parameters(TRANSLATIONS.en[key]), `${locale}:${key}`);
            const params = Object.fromEntries(parameters(dict[key]).map(p => [p, p === 'beamPruned' ? false : `[${p}]`]));
            const rendered = t(key, params, locale);
            assert.ok(rendered.length > 0, `${locale}:${key}`);
            assert.doesNotMatch(rendered, /\{\{|undefined|\[object Object\]/, `${locale}:${key}`);
            if (key === 'solver.status.progress') {
                assert.doesNotMatch(rendered, /false|true/);
                assert.notEqual(t(key, { ...params, beamPruned: true }, locale), rendered);
            }
        }
    }
});

test('original English and Chinese messages, interpolation and English plurals are preserved', async () => {
    const source = execFileSync('git', ['show', '465e66a00613a301fd3fb106af1fce927d6efc61:i18n.js'], { encoding: 'utf8' });
    const original = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    for (const [before, after] of [['en', 'en'], ['cn', 'zh-CN']]) {
        for (const key of Object.keys(TRANSLATIONS.en).filter(k => !k.startsWith('solver.limit.') && !['a11y.graph', 'solver.status.beamPruned'].includes(k))) {
            for (const n of [0, 1, 2, 17]) {
                const params = Object.fromEntries(parameters(TRANSLATIONS.en[key]).map(k => [k, k === 'beamPruned' ? n > 1 : n]));
                assert.equal(t(key, params, after), original.t(key, params, before), `${after}:${key}:${n}`);
            }
        }
    }
});

test('regional language tags and scripts map to supported locales', () => {
    for (const [tag, expected] of Object.entries({ cn: 'zh-CN', 'ZH_cn': 'zh-CN', zh: 'zh-CN', 'zh-SG': 'zh-CN',
        'zh-Hans-TW': 'zh-CN', 'zh-Hant-CN': 'zh-TW', 'zh-TW': 'zh-TW', 'zh-HK': 'zh-TW', 'zh-MO': 'zh-TW',
        'en-GB': 'en', 'ja-JP': 'ja', 'ko-KR': 'ko', 'fr-CA': 'fr', 'de-AT': 'de', 'es-MX': 'es-ES',
        'pt-PT': 'pt-BR', 'ru-RU': 'ru', 'pl-PL': 'pl', 'tr-TR': 'tr', 'th-TH': 'th', 'en-US-u-hc-h12': 'en' })) assert.equal(normalizeLocale(tag), expected, tag);
    for (const invalid of [null, 42, '', 'ar', 'uk-UA', 'xx-YY', 'en<script>', 'en--GB']) assert.equal(normalizeLocale(invalid), null);
});

test('saved > browser list > English, old cn preference, unavailable storage and fallback', () => {
    assert.equal(resolvePreferredLocale({ stored: 'cn', languages: ['de-DE'] }), 'zh-CN');
    assert.equal(resolvePreferredLocale({ stored: 'fr-CA', languages: ['ja'] }), 'fr');
    assert.equal(resolvePreferredLocale({ stored: 'garbage', languages: ['ar', 'zh-Hant-HK', 'en'] }), 'zh-TW');
    assert.equal(resolvePreferredLocale({ languages: ['ar', 'uk-UA'] }), 'en');
    assert.equal(resolvePreferredLocale(), 'en');
    assert.equal(getStoredLocale({ getItem() { throw Error('blocked'); } }), null);
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    try {
        Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('blocked'); } });
        assert.doesNotThrow(() => getPreferredLocale());
        assert.doesNotThrow(() => setStoredLocale('ja'));
    } finally {
        if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else delete globalThis.localStorage;
    }
    const saved = TRANSLATIONS.ja['common.add'];
    try {
        delete TRANSLATIONS.ja['common.add'];
        assert.equal(t('common.add', {}, 'ja'), 'Add');
    } finally { TRANSLATIONS.ja['common.add'] = saved; }
    assert.equal(t('common.add', {}, 'unknown'), 'Add');
    assert.equal(t('missing.key'), 'missing.key');
});

test('locale routes preserve deployment prefixes, query strings and hashes; codes stay invariant', () => {
    assert.equal(getLocalePath('ja', '/shapez2-solver/cn/index.html'), '/shapez2-solver/ja/');
    assert.equal(getLocalePath('zh-HK', '/solver/en/'), '/solver/zh-TW/');
    assert.equal(getLocaleUrl('pt-PT', { pathname: '/shapez2-solver/', search: '?shape=CuCu----', hash: '#graph' }), '/shapez2-solver/pt-BR/?shape=CuCu----#graph');
    assert.equal(getLocaleFromPath('/solver/cn/'), 'zh-CN');
    assert.equal(getLocaleFromPath('/solver/zh-TW/index.html'), 'zh-TW');
    for (const locale of SUPPORTED_LOCALES) {
        assert.equal(setCurrentLocale(locale), locale);
        assert.equal(getOperationDisplayName('unknown-operation', locale), 'unknown-operation');
        assert.equal(getColorDisplayName('CuCu----', locale), 'CuCu----');
        assert.equal(getOperationDisplayName('Cutter', locale), t('operations.cutter', {}, locale));
        assert.ok(getOperationLabel('Painter', { color: 'r' }, locale).includes(getColorDisplayName('r', locale)));
        assert.ok(t('validation.invalidCode', { context: '', errors: '', shapeCode: 'CuCu----' }, locale).includes('CuCu----'));
    }
});

test('HTML, UI call sites and Worker message keys all exist in the common catalog', async () => {
    for (const file of ['index.html', 'main.js', 'operationGraph.js', 'shapeValidation.js', 'shapeSolver.js', 'mixingSolver.js']) {
        const source = await fs.readFile(new URL(`../${file}`, import.meta.url), 'utf8');
        const patterns = [/data-i18n(?:-placeholder|-title|-aria-label)?="([^"]+)"/g,
            /(?:\bt|statusDescriptor)\('([^']+)'/g, /(?:messageKey|errorKey): '([^']+)'/g];
        for (const pattern of patterns) for (const m of source.matchAll(pattern)) assert.ok(m[1] in TRANSLATIONS.en, `${file}: ${m[1]}`);
    }
});
