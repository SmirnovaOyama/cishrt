import { describe, expect, it } from 'vitest';
import editor from '../editorWorker';
import worker, { type Env } from '../worker';
import { readTextOverrides, sanitizeTextOverrides } from '../textOverrides';
import { d1, hasSqlite, migratedDatabase } from './sqliteD1';

/** Synthetic values only. */
const PASSWORD = 'correct-horse-battery';

const setup = (password: string | undefined = PASSWORD, allowed = true) => {
    const db = d1(migratedDatabase());
    const env = {
        DB: db,
        ASSETS: { fetch: async () => new Response('<!doctype html>', { headers: { 'Content-Type': 'text/html' } }) },
        EDITOR_PASSWORD: password,
        RL_EDITOR: { limit: async () => ({ success: allowed }) },
    };
    const call = (path: string, init: RequestInit & { password?: string } = {}) =>
        editor.fetch(
            new Request(`https://cishrt-text.example${path}`, {
                ...init,
                headers: {
                    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
                    ...(init.password !== undefined ? { Authorization: `Bearer ${init.password}` } : {}),
                },
            }),
            env as never,
        );
    return { db, call };
};

describe('text overrides', () => {
    it('keep only known languages, key-shaped keys and bounded text', () => {
        expect(
            sanitizeTextOverrides({
                zh: { 'hc.title': '体检', 'bad key!': 'x', 'hc.add': 5 },
                xx: { 'hc.title': 'nope' },
                en: { 'hc.title': 'y'.repeat(4001) },
            }),
        ).toEqual({ zh: { 'hc.title': '体检' } });
        expect(sanitizeTextOverrides('junk')).toEqual({});
    });
});

describe.skipIf(!hasSqlite)('the text editor', () => {
    it('refuses everything until a real password is set', async () => {
        const { call } = setup('short');
        expect((await call('/api/text', { password: 'short' })).status).toBe(503);
    });

    it('refuses a wrong password and slows guessing', async () => {
        expect((await setup().call('/api/text', { password: 'wrong' })).status).toBe(401);
        expect((await setup().call('/api/text')).status).toBe(401);
        expect((await setup(PASSWORD, false).call('/api/text', { password: PASSWORD })).status).toBe(429);
    });

    it('saves, rewrites and restores a string, which the site then serves', async () => {
        const { db, call } = setup();
        const put = (value: string) =>
            call('/api/text', {
                method: 'PUT',
                password: PASSWORD,
                body: JSON.stringify({ lang: 'zh', key: 'hc.title', value }),
            });
        expect((await put('体检报告')).status).toBe(204);
        expect((await put('我的体检')).status).toBe(204);
        expect(await readTextOverrides(db as unknown as D1Database)).toEqual({ zh: { 'hc.title': '我的体检' } });
        expect(await (await call('/api/text', { password: PASSWORD })).json()).toEqual({
            zh: { 'hc.title': '我的体检' },
        });

        const del = await call('/api/text', {
            method: 'DELETE',
            password: PASSWORD,
            body: JSON.stringify({ lang: 'zh', key: 'hc.title' }),
        });
        expect(del.status).toBe(204);
        expect(await readTextOverrides(db as unknown as D1Database)).toEqual({});
    });

    it('refuses an unknown language, a malformed key or oversized text', async () => {
        const { call } = setup();
        for (const body of [
            { lang: 'xx', key: 'hc.title', value: 'a' },
            { lang: 'zh', key: '../etc', value: 'a' },
            { lang: 'zh', key: 'hc.title', value: 'a'.repeat(4001) },
            { lang: 'zh', key: 'hc.title' },
        ]) {
            const res = await call('/api/text', { method: 'PUT', password: PASSWORD, body: JSON.stringify(body) });
            expect(res.status).toBe(400);
        }
    });

    it('reach every visitor of the site through its public endpoint', async () => {
        const { db, call } = setup();
        await call('/api/text', {
            method: 'PUT',
            password: PASSWORD,
            body: JSON.stringify({ lang: 'en', key: 'hc.title', value: 'My check-up' }),
        });
        const res = await worker.fetch(
            new Request('https://cishrt.example/api/text'),
            {
                DB: db,
                JWT_SECRET: 'K7fQ2vRm9pLxT4wYzA6bC1dE8fG3hJ5n',
                RL_PER_MINUTE_60: { limit: async () => ({ success: true }) },
            } as unknown as Env,
            { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as Parameters<typeof worker.fetch>[2],
        );
        expect(res.status).toBe(200);
        expect(res.headers.get('Cache-Control')).toBe('no-cache');
        expect(await res.json()).toEqual({ en: { 'hc.title': 'My check-up' } });
    });

    it('serves the page with its security headers', async () => {
        const res = await setup().call('/');
        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
        expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    });
});
