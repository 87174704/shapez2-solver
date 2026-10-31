// One registry for every build profile. cn is a legacy URL/storage alias only.
export const DEFAULT_LOCALE = 'en';
export const LANGUAGE_STORAGE_KEY = 'shapez2-solver-locale';
export const LANGUAGE_NAMES = Object.freeze({
    'zh-CN': '简体中文', 'zh-TW': '繁體中文', en: 'English', ja: '日本語',
    ko: '한국어', fr: 'Français', de: 'Deutsch', 'es-ES': 'Español',
    'pt-BR': 'Português (Brasil)', ru: 'Русский', pl: 'Polski', tr: 'Türkçe', th: 'ไทย',
});
export const SUPPORTED_LOCALES = Object.freeze(Object.keys(LANGUAGE_NAMES));

export function normalizeLocale(locale) {
    if (typeof locale !== 'string') return null;
    let tag = locale.trim().replaceAll('_', '-').toLowerCase();
    if (tag === 'cn') return 'zh-CN';
    const exact = SUPPORTED_LOCALES.find(code => code.toLowerCase() === tag);
    if (exact) return exact;
    try { tag = Intl.getCanonicalLocales(tag)[0].toLowerCase(); } catch { return null; }
    const [language, ...parts] = tag.split('-');
    if (language === 'zh') {
        if (parts.includes('hant')) return 'zh-TW';
        if (parts.includes('hans')) return 'zh-CN';
        return parts.some(p => ['tw', 'hk', 'mo'].includes(p)) ? 'zh-TW' : 'zh-CN';
    }
    if (language === 'es') return 'es-ES';
    if (language === 'pt') return 'pt-BR';
    return SUPPORTED_LOCALES.includes(language) ? language : null;
}

export function getStoredLocale(storage) {
    try { return normalizeLocale((storage ?? globalThis.localStorage)?.getItem(LANGUAGE_STORAGE_KEY)); }
    catch { return null; }
}

export function resolvePreferredLocale({ stored, languages = [] } = {}) {
    return normalizeLocale(stored) ?? languages.map(normalizeLocale).find(Boolean) ?? DEFAULT_LOCALE;
}

export function getPreferredLocale() {
    // Access can itself throw in privacy-restricted browser contexts.
    let stored;
    try { stored = globalThis.localStorage?.getItem(LANGUAGE_STORAGE_KEY); } catch {}
    const navigator = globalThis.navigator;
    return resolvePreferredLocale({ stored, languages: navigator?.languages?.length ? navigator.languages : [navigator?.language] });
}
