// The text editor for the cis edition (cishrt-text.mahiro.uk): its operator
// rewrites any string the site shows, in any of its languages, and the site
// picks the change up on its next load (see textOverrides.ts). It shares the
// site's database and nothing else: no accounts, one password.
//
// Set the password with `wrangler secret put EDITOR_PASSWORD -c wrangler.editor.toml`.
// Without one of at least 12 characters every write is refused.

import { TEXT_KEY, TEXT_VALUE_MAX, isTextLang, readTextOverrides } from './textOverrides';
import { constantTimeEqual, sha256Hex } from './workerUtil';

interface Env {
    DB: D1Database;
    ASSETS: Fetcher;
    EDITOR_PASSWORD?: string;
    RL_EDITOR: RateLimit;
}

const SECURITY_HEADERS: Record<string, string> = {
    'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Strict-Transport-Security': 'max-age=31536000',
};

const withSecurity = (res: Response): Response => {
    const out = new Response(res.body, res);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) out.headers.set(name, value);
    return out;
};

const json = (body: unknown, status = 200): Response =>
    withSecurity(
        new Response(body === null ? null : JSON.stringify(body), {
            status,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        }),
    );

const MIN_PASSWORD = 12;
const MAX_BODY = 16 * 1024;
/** Compared as digests, so the time taken says nothing about the password, not even its length. */
async function passwordMatches(request: Request, expected: string): Promise<boolean> {
    const header = request.headers.get('Authorization') ?? '';
    const given = header.startsWith('Bearer ') ? header.slice(7) : '';
    return constantTimeEqual(await sha256Hex(given), await sha256Hex(expected));
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
    const text = await request.text();
    if (text.length > MAX_BODY) return null;
    try {
        const value = JSON.parse(text);
        return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
    } catch {
        return null;
    }
}

async function handleApi(request: Request, env: Env, path: string): Promise<Response> {
    // Every call counts, right or wrong password, so guessing is slow.
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    if (!(await env.RL_EDITOR.limit({ key: `editor:${ip}` })).success) return json({ error: 'RATE_LIMITED' }, 429);

    const expected = env.EDITOR_PASSWORD ?? '';
    if (expected.length < MIN_PASSWORD) return json({ error: 'NOT_CONFIGURED' }, 503);
    if (!(await passwordMatches(request, expected))) return json({ error: 'UNAUTHORIZED' }, 401);

    if (path === '/api/session' && request.method === 'GET') return json(null, 204);

    if (path === '/api/text' && request.method === 'GET') return json(await readTextOverrides(env.DB));

    if (path === '/api/text' && (request.method === 'PUT' || request.method === 'DELETE')) {
        const body = await readBody(request);
        const lang = body?.lang;
        const key = body?.key;
        if (!isTextLang(lang) || typeof key !== 'string' || !TEXT_KEY.test(key)) return json({ error: 'INVALID' }, 400);
        if (request.method === 'DELETE') {
            await env.DB.prepare('DELETE FROM text_overrides WHERE lang = ? AND key = ?').bind(lang, key).run();
            return json(null, 204);
        }
        const value = body?.value;
        if (typeof value !== 'string' || value.length > TEXT_VALUE_MAX) return json({ error: 'INVALID' }, 400);
        await env.DB.prepare(
            `INSERT INTO text_overrides (lang, key, value, updated_at) VALUES (?, ?, ?, ?)
             ON CONFLICT (lang, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        )
            .bind(lang, key, value, Date.now())
            .run();
        return json(null, 204);
    }

    return json({ error: 'NOT_FOUND' }, 404);
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const path = new URL(request.url).pathname;
        if (path.startsWith('/api/')) return handleApi(request, env, path);
        return withSecurity(await env.ASSETS.fetch(request));
    },
};
