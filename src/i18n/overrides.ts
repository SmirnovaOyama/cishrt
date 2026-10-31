import { apiEndpoint } from '../services/apiClient';
import { TextOverrides, sanitizeTextOverrides } from '../../textOverrides';

/** The last overrides this device saw: the edited words from the first paint, and offline. */
const CACHE_KEY = 'hrt-text-overrides';

export function cachedTextOverrides(): TextOverrides {
    try {
        return sanitizeTextOverrides(JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null'));
    } catch {
        return {};
    }
}

/**
 * The text the operator rewrote in the editor (see textOverrides.ts), fresh
 * from the site, or null when it can't be had: the cached copy stands then.
 */
export async function fetchTextOverrides(): Promise<TextOverrides | null> {
    try {
        const res = await fetch(apiEndpoint('/api/text'), { cache: 'no-cache' });
        if (!res.ok) return null;
        const next = sanitizeTextOverrides(await res.json());
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(next));
        } catch {
            /* storage full or blocked: this load still has them */
        }
        return next;
    } catch {
        return null;
    }
}
