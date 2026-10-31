import React, { createContext, useContext, useState, useEffect } from 'react';
import { TRANSLATIONS, Lang } from '../i18n/translations';
import { setAppLocale } from '../i18n/locale';
import { cachedTextOverrides, fetchTextOverrides } from '../i18n/overrides';
import { IS_CIS } from '../edition';
import type { TextOverrides } from '../../textOverrides';

const LanguageContext = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: string) => string } | null>(
    null,
);

export const useTranslation = () => {
    const ctx = useContext(LanguageContext);
    if (!ctx) throw new Error('useTranslation must be used within LanguageProvider');
    return ctx;
};

const LANG_LOCALE: Record<Lang, string> = {
    zh: 'zh-CN',
    'zh-TW': 'zh-TW',
    yue: 'zh-HK',
    en: 'en',
    ja: 'ja',
    ko: 'ko',
    tr: 'tr',
};

/**
 * Where a key falls through to when its own pack hasn't got it.
 *
 * The old chain was zh then en for everyone, which put Simplified Chinese in
 * front of a Turkish or Korean reader — a script they may not read at all —
 * ahead of English, which most of them can at least muddle through. So the
 * script the reader is likeliest to recognise goes first: the Chinese packs
 * fall back among themselves, and everyone else takes English before Chinese.
 *
 * zh and en still point at each other last, because between them they carry
 * every key in the app, so nothing can fall all the way through to a raw
 * dotted key.
 */
export const FALLBACK: Record<Lang, readonly Lang[]> = {
    zh: ['en'],
    'zh-TW': ['zh', 'en'],
    yue: ['zh-TW', 'zh', 'en'],
    en: ['zh'],
    ja: ['en', 'zh'],
    ko: ['en', 'zh'],
    tr: ['en', 'zh'],
};

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
    const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('hrt-lang') as Lang) || 'zh');
    setAppLocale(LANG_LOCALE[lang] ?? lang);

    // The cis edition's operator rewrites its text in a separate editor (see
    // textOverrides.ts). Those words come first in every pack, so they win
    // wherever a key is looked up, fallbacks included.
    const [overrides, setOverrides] = useState<TextOverrides>(() => (IS_CIS ? cachedTextOverrides() : {}));
    useEffect(() => {
        if (!IS_CIS) return;
        let live = true;
        void fetchTextOverrides().then(next => {
            if (live && next) setOverrides(next);
        });
        return () => {
            live = false;
        };
    }, []);

    const t = (key: string) => {
        const packs = TRANSLATIONS as Record<string, Record<string, string>>;
        for (const pack of [lang, ...(FALLBACK[lang] ?? FALLBACK.zh)]) {
            const value = overrides[pack]?.[key] ?? packs[pack]?.[key];
            if (value !== undefined) return value;
        }
        return key;
    };

    useEffect(() => {
        localStorage.setItem('hrt-lang', lang);
        document.title = t('app.title');
        document.documentElement.lang = LANG_LOCALE[lang] ?? lang;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lang, overrides]);

    return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
};
