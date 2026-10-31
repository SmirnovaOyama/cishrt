// The cis edition's rewritten text: what its operator changed in the text
// editor (editorWorker.ts, cishrt-text.mahiro.uk), one string per language and
// key, kept in the `text_overrides` table (migration 0014). The site's own
// Worker hands it out at GET /api/text and the app lays it over its language
// packs, so a wording change is live on the next page load, with no deploy.

/** The app's languages, as its packs name them (src/i18n/translations.ts). */
export const TEXT_LANGS = ['zh', 'zh-TW', 'yue', 'en', 'ja', 'ko', 'tr'] as const;
export type TextLang = (typeof TEXT_LANGS)[number];

/** A string key as the packs write them: 'hc.paste_found', 'status.level.cis_high'. */
export const TEXT_KEY = /^[A-Za-z0-9_.-]{1,160}$/;

/** Longer than any string in the app; anything past it is a paste gone wrong. */
export const TEXT_VALUE_MAX = 4000;

/** language -> key -> text. */
export type TextOverrides = Record<string, Record<string, string>>;

export const isTextLang = (v: unknown): v is TextLang =>
    typeof v === 'string' && (TEXT_LANGS as readonly string[]).includes(v);

/**
 * Keep only what could have been saved: a known language, a key shaped like
 * one, text within bounds. Run on the way in from storage, the network and a
 * cached copy alike, since the app trusts none of them.
 */
export function sanitizeTextOverrides(raw: unknown): TextOverrides {
    const out: TextOverrides = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    for (const [lang, strings] of Object.entries(raw as Record<string, unknown>)) {
        if (!isTextLang(lang) || !strings || typeof strings !== 'object' || Array.isArray(strings)) continue;
        for (const [key, value] of Object.entries(strings as Record<string, unknown>)) {
            if (!TEXT_KEY.test(key) || typeof value !== 'string' || value.length > TEXT_VALUE_MAX) continue;
            (out[lang] ??= {})[key] = value;
        }
    }
    return out;
}

/**
 * Every override, grouped by language. A database without the table (one this
 * migration hasn't reached) has none, rather than an error: the app's own text
 * is the answer then.
 */
export async function readTextOverrides(db: D1Database): Promise<TextOverrides> {
    try {
        const { results } = await db
            .prepare('SELECT lang, key, value FROM text_overrides')
            .all<{ lang: string; key: string; value: string }>();
        const out: TextOverrides = {};
        for (const row of results ?? []) (out[row.lang] ??= {})[row.key] = row.value;
        return sanitizeTextOverrides(out);
    } catch {
        return {};
    }
}
