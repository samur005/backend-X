/**
 * Optional fallback: create a VK hash through a WDTT panel
 * (ildarmaga/wdtt POST /panel/api/vk/call/create).
 *
 * That endpoint is session+CSRF protected. The operator must supply a Cookie
 * header and, if the panel requires it, a CSRF token. This is not present in
 * current 3s-ui; it is implemented here as a last-resort source after env pins
 * and first-party VK cookies.
 */

import { stripHash } from './qwdtt-links';

export interface IRemoteWdttConfig {
    baseUrl: string;
    cookie: string;
    csrfToken: string;
}

export async function createHashViaRemotePanel(
    config: IRemoteWdttConfig,
    fetchImpl: typeof fetch = fetch,
): Promise<{ hash: string; joinLink: string }> {
    const base = config.baseUrl.trim().replace(/\/+$/, '');
    if (!base) {
        throw new Error('remote WDTT URL is empty');
    }
    if (!config.cookie.trim()) {
        throw new Error('remote WDTT cookie is empty');
    }
    const url = `${base}/panel/api/vk/call/create`;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Cookie: config.cookie.trim(),
        Accept: 'application/json',
    };
    if (config.csrfToken.trim()) {
        headers['X-CSRF-Token'] = config.csrfToken.trim();
        headers['X-CSRFToken'] = config.csrfToken.trim();
    }
    const response = await fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ password: '', apply: false }),
        signal: AbortSignal.timeout(30_000),
    });
    const text = await response.text();
    if (!response.ok) {
        throw new Error(`remote WDTT ${response.status}: ${text.slice(0, 200)}`);
    }
    let parsed: {
        ok?: boolean;
        success?: boolean;
        vk_hash?: string;
        join_link?: string;
        data?: { vk_hash?: string; join_link?: string };
        error?: string;
        message?: string;
    };
    try {
        parsed = JSON.parse(text) as typeof parsed;
    } catch {
        throw new Error(`remote WDTT: invalid JSON: ${text.slice(0, 200)}`);
    }
    if (parsed.ok === false || parsed.success === false) {
        throw new Error(parsed.error || parsed.message || 'remote WDTT refused the request');
    }
    const joinLink = parsed.join_link || parsed.data?.join_link || '';
    const hash = stripHash(parsed.vk_hash || parsed.data?.vk_hash || joinLink);
    if (!hash) {
        throw new Error(`remote WDTT: no hash in answer: ${text.slice(0, 200)}`);
    }
    return { hash, joinLink };
}
