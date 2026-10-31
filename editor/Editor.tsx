import React, { useEffect, useMemo, useState } from 'react';
import { TRANSLATIONS } from '../src/i18n/translations';
import { FALLBACK } from '../src/contexts/LanguageContext';
import { TEXT_LANGS, TEXT_VALUE_MAX, sanitizeTextOverrides, type TextLang, type TextOverrides } from '../textOverrides';

/**
 * The cis edition's text editor. Every string the site shows, in each of its
 * languages, as the site would show it now; open one, rewrite it, save, and
 * cishrt.mahiro.uk shows the new words from its next load. Built with the cis
 * edition's packs, so what it lists is that site's text, not the trans one's.
 */

const SITE = 'https://cishrt.mahiro.uk';
const PASSWORD_KEY = 'cishrt-text-password';

const LANG_NAMES: Record<TextLang, string> = {
    zh: '简体中文',
    'zh-TW': '正體中文',
    yue: '廣東話',
    en: 'English',
    ja: '日本語',
    ko: '한국어',
    tr: 'Türkçe',
};

const packs = TRANSLATIONS as unknown as Record<string, Record<string, string>>;

// Every key any pack has: a string only some languages carry can still be
// written for the others, which until then show it through their fallback.
const ALL_KEYS = [...new Set(TEXT_LANGS.flatMap(lang => Object.keys(packs[lang] ?? {})))].sort();

const chainOf = (lang: TextLang): readonly string[] => [lang, ...(FALLBACK[lang] ?? FALLBACK.zh)];

/** What the site shows for a key, and which pack it comes from: the app's own lookup, edits first. */
function lookup(lang: TextLang, key: string, overrides: TextOverrides): { text: string; from: string } {
    for (const pack of chainOf(lang)) {
        const value = overrides[pack]?.[key] ?? packs[pack]?.[key];
        if (value !== undefined) return { text: value, from: pack };
    }
    return { text: key, from: lang };
}

/** The app's own words, before any edit. */
const original = (lang: TextLang, key: string) => lookup(lang, key, {}).text;

/** "{n}", "{value}": filled in by the site, so an edit must keep them. */
const placeholders = (s: string) => [...new Set(s.match(/\{[A-Za-z_]+\}/g) ?? [])];

const muted = 'text-[var(--text-muted)]';
const divider = 'border-b-(length:--hairline) border-[var(--border)]';

const failure = (status: number) =>
    status === 401
        ? '密码不对'
        : status === 429
          ? '试得太频繁了，等一分钟再来'
          : status === 503
            ? '编辑器还没有设置密码'
            : '没有连上，稍后再试';

function api(path: string, password: string, init: RequestInit = {}): Promise<Response> {
    return fetch(path, {
        ...init,
        headers: {
            ...(init.body ? { 'Content-Type': 'application/json' } : {}),
            Authorization: `Bearer ${password}`,
        },
    });
}

const SignIn: React.FC<{ onReady: (password: string, overrides: TextOverrides) => void }> = ({ onReady }) => {
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password || busy) return;
        setBusy(true);
        setError('');
        try {
            const res = await api('/api/text', password);
            if (!res.ok) {
                setError(failure(res.status));
                return;
            }
            onReady(password, sanitizeTextOverrides(await res.json()));
        } catch {
            setError(failure(0));
        } finally {
            setBusy(false);
        }
    };

    return (
        <form onSubmit={submit} className="mx-auto max-w-md px-6 pt-24">
            <h1 className="text-[1.625rem] font-semibold">文字编辑</h1>
            <p className={`mt-3 text-sm leading-relaxed ${muted}`}>
                改 cishrt.mahiro.uk 上的任何一句话。保存之后，网站下次打开就是新的文字。
            </p>
            <label className="mt-8 block text-sm" htmlFor="password">
                密码
            </label>
            <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-base mt-1"
                style={{ fontSize: '16px' }}
            />
            <p className={`mt-3 min-h-[1.25rem] text-xs text-[var(--danger)] ${error ? '' : 'invisible'}`}>{error}</p>
            <button type="submit" disabled={!password || busy} className="btn-primary mt-4 min-w-[88px]">
                进入
            </button>
        </form>
    );
};

interface RowProps {
    lang: TextLang;
    k: string;
    overrides: TextOverrides;
    open: boolean;
    onToggle: () => void;
    onSaved: (value: string | null) => void;
    password: string;
}

/**
 * The open part of a row. Mounted only while the row is open, so each opening
 * starts from what the site shows now.
 */
const RowEditor: React.FC<Omit<RowProps, 'open'>> = ({ lang, k, overrides, onToggle, onSaved, password }) => {
    const shown = lookup(lang, k, overrides).text;
    const own = original(lang, k);
    const edited = overrides[lang]?.[k] !== undefined;
    const [draft, setDraft] = useState(shown);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const missing = placeholders(own).filter(p => !draft.includes(p));

    const send = async (value: string | null) => {
        setBusy(true);
        setError('');
        try {
            const res = await api('/api/text', password, {
                method: value === null ? 'DELETE' : 'PUT',
                body: JSON.stringify(value === null ? { lang, key: k } : { lang, key: k, value }),
            });
            if (!res.ok) {
                setError(failure(res.status));
                return;
            }
            onSaved(value);
        } catch {
            setError(failure(0));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="pb-4 pt-1">
            <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                rows={Math.min(10, Math.max(2, Math.ceil(draft.length / 40)))}
                maxLength={TEXT_VALUE_MAX}
                aria-label={k}
                className="input-base w-full resize-y"
                style={{ fontSize: '16px' }}
                autoFocus
            />
            {edited && <p className={`pt-2 text-xs leading-relaxed ${muted}`}>原文：{own}</p>}
            {missing.length > 0 && (
                <p className="pt-2 text-xs leading-relaxed text-[var(--warning)]">
                    别漏了 {missing.join('、')}：网站会在这里填上数字或名称
                </p>
            )}
            {error && <p className="pt-2 text-xs text-[var(--danger)]">{error}</p>}
            <div className="flex items-center justify-between pt-4">
                {edited ? (
                    <button
                        type="button"
                        onClick={() => void send(null)}
                        disabled={busy}
                        className="text-sm font-medium text-[var(--danger)]"
                    >
                        恢复原文
                    </button>
                ) : (
                    <span />
                )}
                <span className="flex gap-2">
                    <button
                        type="button"
                        onClick={onToggle}
                        className={`min-w-[88px] rounded-md px-4 py-2 text-sm ${muted} hover:bg-[var(--surface-hover)]`}
                    >
                        取消
                    </button>
                    {/* Saving the app's own words back is the same as no edit at all. */}
                    <button
                        type="button"
                        onClick={() => void send(draft === own ? null : draft)}
                        disabled={draft === shown || busy}
                        className="btn-primary min-w-[88px]"
                    >
                        保存
                    </button>
                </span>
            </div>
        </div>
    );
};

const Row: React.FC<RowProps> = ({ open, ...props }) => {
    const { lang, k, overrides, onToggle } = props;
    const shown = lookup(lang, k, overrides);
    const edited = overrides[lang]?.[k] !== undefined;
    const notes = [k, edited ? '已改' : '', shown.from !== lang ? `沿用${LANG_NAMES[shown.from as TextLang]}` : '']
        .filter(Boolean)
        .join('，');

    return (
        <div className={divider}>
            <button
                type="button"
                aria-expanded={open}
                onClick={onToggle}
                className={`-mx-2 w-[calc(100%+1rem)] rounded-md px-2 py-3 text-start hover:bg-[var(--surface-hover)] ${open ? 'bg-[var(--surface-hover)]' : ''}`}
            >
                <span className="flex items-start gap-3">
                    <span
                        className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${edited ? 'bg-[var(--accent)]' : 'bg-transparent'}`}
                    />
                    <span className="min-w-0 flex-1">
                        <span className={`block whitespace-pre-line text-sm ${open ? '' : 'line-clamp-2'}`}>
                            {shown.text}
                        </span>
                        <span className={`mt-1 block break-all text-xs ${muted}`}>{notes}</span>
                    </span>
                </span>
            </button>
            {open && <RowEditor {...props} />}
        </div>
    );
};

const Editor: React.FC = () => {
    const [password, setPassword] = useState(() => sessionStorage.getItem(PASSWORD_KEY) ?? '');
    const [overrides, setOverrides] = useState<TextOverrides | null>(null);
    const [lang, setLang] = useState<TextLang>('zh');
    const [query, setQuery] = useState('');
    const [onlyEdited, setOnlyEdited] = useState(false);
    const [openKey, setOpenKey] = useState<string | null>(null);

    const signOut = () => {
        sessionStorage.removeItem(PASSWORD_KEY);
        setPassword('');
        setOverrides(null);
    };

    // A password kept from earlier in this tab signs straight back in.
    useEffect(() => {
        if (!password || overrides) return;
        api('/api/text', password)
            .then(async res => {
                if (res.ok) setOverrides(sanitizeTextOverrides(await res.json()));
                else signOut();
            })
            .catch(signOut);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const editedCount = overrides ? Object.keys(overrides[lang] ?? {}).length : 0;
    const keys = useMemo(() => {
        if (!overrides) return [];
        const q = query.trim().toLowerCase();
        return ALL_KEYS.filter(k => {
            if (onlyEdited && overrides[lang]?.[k] === undefined) return false;
            if (!q) return true;
            return k.toLowerCase().includes(q) || lookup(lang, k, overrides).text.toLowerCase().includes(q);
        });
    }, [overrides, lang, query, onlyEdited]);
    // The first key of each group ('hc', 'status'…) carries its heading.
    const groupStarts = useMemo(
        () => new Set(keys.filter((k, i) => i === 0 || k.split('.')[0] !== keys[i - 1].split('.')[0])),
        [keys],
    );

    if (!overrides) {
        if (password) return null;
        return (
            <SignIn
                onReady={(next, loaded) => {
                    sessionStorage.setItem(PASSWORD_KEY, next);
                    setPassword(next);
                    setOverrides(loaded);
                }}
            />
        );
    }

    const saved = (k: string) => (value: string | null) => {
        setOverrides(prev => {
            const next: TextOverrides = { ...prev, [lang]: { ...(prev?.[lang] ?? {}) } };
            if (value === null) delete next[lang][k];
            else next[lang][k] = value;
            return next;
        });
        setOpenKey(null);
    };

    return (
        <div className="mx-auto max-w-2xl px-6 pb-24 pt-10">
            <header className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <h1 className="text-[1.625rem] font-semibold">文字编辑</h1>
                    <p className={`mt-2 text-sm leading-relaxed ${muted}`}>
                        保存之后，
                        <a href={SITE} target="_blank" rel="noreferrer" className="text-[var(--accent-ink)]">
                            cishrt.mahiro.uk
                        </a>
                        下次打开就是新的文字。
                    </p>
                </div>
                <button type="button" onClick={signOut} className={`shrink-0 pt-2 text-sm ${muted}`}>
                    退出
                </button>
            </header>

            <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-2" aria-label="语言">
                {TEXT_LANGS.map(l => (
                    <button
                        key={l}
                        type="button"
                        aria-pressed={l === lang}
                        onClick={() => {
                            setLang(l);
                            setOpenKey(null);
                        }}
                        className={`border-b-2 pb-1 text-sm ${l === lang ? 'border-[var(--accent)] font-semibold' : `border-transparent ${muted}`}`}
                    >
                        {LANG_NAMES[l]}
                    </button>
                ))}
            </nav>

            <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="搜文字或键名"
                aria-label="搜文字或键名"
                className="input-base mt-6"
                style={{ fontSize: '16px' }}
            />
            <div className={`flex items-center justify-between py-3 text-xs ${muted}`}>
                <span>
                    {keys.length} 条{editedCount > 0 ? `，改过 ${editedCount} 条` : ''}
                </span>
                <button
                    type="button"
                    aria-pressed={onlyEdited}
                    onClick={() => setOnlyEdited(v => !v)}
                    className={onlyEdited ? 'font-semibold text-[var(--text)]' : ''}
                >
                    只看改过的
                </button>
            </div>

            <div>
                {keys.map(k => {
                    return (
                        <React.Fragment key={k}>
                            {groupStarts.has(k) && <h2 className="group-heading pt-6 pb-1">{k.split('.')[0]}</h2>}
                            <Row
                                lang={lang}
                                k={k}
                                overrides={overrides}
                                open={openKey === k}
                                onToggle={() => setOpenKey(openKey === k ? null : k)}
                                onSaved={saved(k)}
                                password={password}
                            />
                        </React.Fragment>
                    );
                })}
                {keys.length === 0 && <p className={`py-16 text-center text-sm ${muted}`}>没有找到</p>}
            </div>
        </div>
    );
};

export default Editor;
