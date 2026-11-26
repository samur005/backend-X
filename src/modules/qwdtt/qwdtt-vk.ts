/**
 * VK call API helpers ported from samur005/3s-ui qwdtt/vk.go (GPL-3.0).
 * Combined work is licensed under AGPL-3.0-only.
 *
 * Session cookies are exchanged for an access token, calls.start creates a
 * call whose join link carries the hash, and calls.getCallPreview tells
 * whether a call still runs.
 */

import { JOIN_URL_BASE, stripHash } from './qwdtt-links';

const VK_APP_ID = '6287487';
const VK_API_VERSION = '5.280';
const VK_WEB_HOST = 'vk.ru';
const VK_USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';
const VK_AUTH_COOKIE = 'remixsid';

export interface ICookieEntry {
    name: string;
    value: string;
}

export interface ICreatedCall {
    callId: string;
    joinLink: string;
    hash: string;
    startedAt: number;
}

export class VkTransportError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'VkTransportError';
    }
}

export type VkPoster = (
    endpoint: string,
    form: URLSearchParams,
    headers: Record<string, string>,
) => Promise<string>;

const defaultPoster: VkPoster = async (endpoint, form, headers) => {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': VK_USER_AGENT,
            Origin: `https://${VK_WEB_HOST}`,
            Referer: `https://${VK_WEB_HOST}/`,
            ...headers,
        },
        body: form.toString(),
        signal: AbortSignal.timeout(30_000),
    });
    return response.text();
};

export class QwdttVkClient {
    constructor(private readonly post: VkPoster = defaultPoster) {}

    public parseCookies(raw: string): string {
        const trimmed = raw.trim();
        if (!trimmed) {
            throw new Error('cookies are empty');
        }
        let cookies: ICookieEntry[] = [];
        if (trimmed.startsWith('[')) {
            const parsed = JSON.parse(trimmed) as ICookieEntry[];
            if (!Array.isArray(parsed)) {
                throw new Error('invalid cookies JSON');
            }
            cookies = parsed;
        } else {
            const header = trimmed.replace(/^Cookie:\s*/i, '');
            for (const part of header.split(';')) {
                const idx = part.indexOf('=');
                if (idx <= 0) {
                    continue;
                }
                cookies.push({
                    name: part.slice(0, idx).trim(),
                    value: part.slice(idx + 1).trim(),
                });
            }
        }
        const clean: ICookieEntry[] = [];
        let hasAuth = false;
        for (const cookie of cookies) {
            const name = (cookie.name ?? '').trim();
            const value = cookie.value ?? '';
            if (!name) {
                continue;
            }
            if (/[\r\n;]/.test(name + value)) {
                throw new Error('cookies contain invalid characters');
            }
            if (name === VK_AUTH_COOKIE && value.trim()) {
                hasAuth = true;
            }
            clean.push({ name, value });
        }
        if (clean.length === 0) {
            throw new Error('cookies are empty');
        }
        if (!hasAuth) {
            throw new Error(
                `no ${VK_AUTH_COOKIE} cookie: log in to VK and export the cookies again`,
            );
        }
        return JSON.stringify(clean);
    }

    public cookieHeader(cookiesJson: string): string {
        if (!cookiesJson.trim()) {
            throw new Error('VK cookies are not set');
        }
        const cookies = JSON.parse(cookiesJson) as ICookieEntry[];
        const parts = cookies
            .filter((cookie) => cookie.name)
            .map((cookie) => `${cookie.name}=${cookie.value}`);
        if (parts.length === 0) {
            throw new Error('VK cookies are empty');
        }
        return parts.join('; ');
    }

    public async createCall(cookiesJson: string): Promise<ICreatedCall> {
        const cookies = this.cookieHeader(cookiesJson);
        const token = await this.webToken(cookies);
        const peer = await this.currentUserId(token);
        const body = await this.apiCall(
            token,
            'calls.start',
            new URLSearchParams({ peer_id: peer }),
        );
        const parsed = JSON.parse(body) as {
            response?: { call_id?: string; join_link?: string };
        };
        const callId = parsed.response?.call_id ?? '';
        const joinLink = parsed.response?.join_link ?? '';
        if (!callId || !joinLink) {
            throw new Error(`calls.start: incomplete answer: ${truncate(body, 200)}`);
        }
        const hash = stripHash(joinLink);
        if (!hash) {
            throw new Error(`cannot read a hash from "${joinLink}"`);
        }
        return { callId, joinLink, hash, startedAt: Math.floor(Date.now() / 1000) };
    }

    public async finishCall(cookiesJson: string, callId: string): Promise<void> {
        if (!callId.trim()) {
            throw new Error('empty call id');
        }
        const token = await this.webToken(this.cookieHeader(cookiesJson));
        const body = await this.apiCall(
            token,
            'calls.forceFinish',
            new URLSearchParams({ call_id: callId }),
        );
        const parsed = JSON.parse(body) as { response?: number };
        if (parsed.response !== 1) {
            throw new Error(`calls.forceFinish: unexpected answer: ${truncate(body, 200)}`);
        }
    }

    public async callAlive(hash: string): Promise<boolean> {
        const bare = stripHash(hash);
        if (!bare) {
            throw new Error('empty hash');
        }
        const token = await this.anonToken();
        let body: string;
        try {
            body = await this.post(
                `https://api.${VK_WEB_HOST}/method/calls.getCallPreview`,
                new URLSearchParams({
                    v: VK_API_VERSION,
                    vk_join_link: JOIN_URL_BASE + bare,
                }),
                { Authorization: `Bearer ${token}` },
            );
        } catch (error) {
            throw new VkTransportError(
                `calls.getCallPreview: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
        if (parseApiError(body)) {
            return false;
        }
        const parsed = JSON.parse(body) as { response?: { ok_join_link?: string } };
        return Boolean(parsed.response?.ok_join_link);
    }

    public async checkCookies(cookiesJson: string): Promise<void> {
        const token = await this.webToken(this.cookieHeader(cookiesJson));
        await this.currentUserId(token);
    }

    private async webToken(cookies: string): Promise<string> {
        let body: string;
        try {
            body = await this.post(
                `https://login.${VK_WEB_HOST}/?act=web_token`,
                new URLSearchParams({ version: '1', app_id: VK_APP_ID }),
                { Cookie: cookies },
            );
        } catch (error) {
            throw new VkTransportError(
                `web_token: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
        const parsed = JSON.parse(body) as { data?: { access_token?: string } };
        const token = parsed.data?.access_token ?? '';
        if (!token) {
            throw new Error(`VK returned no token (cookies expired?): ${truncate(body, 200)}`);
        }
        return token;
    }

    private async anonToken(): Promise<string> {
        let body: string;
        try {
            body = await this.post(
                `https://login.${VK_WEB_HOST}/?act=get_anonym_token`,
                new URLSearchParams({ client_id: VK_APP_ID }),
                {},
            );
        } catch (error) {
            throw new VkTransportError(
                `get_anonym_token: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
        const parsed = JSON.parse(body) as { data?: { access_token?: string } };
        const token = parsed.data?.access_token ?? '';
        if (!token) {
            throw new Error('VK returned no anonymous token');
        }
        return token;
    }

    private async apiCall(token: string, method: string, form: URLSearchParams): Promise<string> {
        form.set('v', VK_API_VERSION);
        let body: string;
        try {
            body = await this.post(`https://api.${VK_WEB_HOST}/method/${method}`, form, {
                Authorization: `Bearer ${token}`,
            });
        } catch (error) {
            throw new VkTransportError(
                `${method}: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
        const apiError = parseApiError(body);
        if (apiError) {
            throw new Error(apiError);
        }
        return body;
    }

    private async currentUserId(token: string): Promise<string> {
        const body = await this.apiCall(token, 'users.get', new URLSearchParams());
        const parsed = JSON.parse(body) as { response?: Array<{ id?: number }> };
        const id = parsed.response?.[0]?.id;
        if (!id) {
            throw new Error(`users.get: empty id: ${truncate(body, 200)}`);
        }
        return String(id);
    }
}

function parseApiError(body: string): string | null {
    try {
        const parsed = JSON.parse(body) as { error?: { error_code?: number; error_msg?: string } };
        if (!parsed.error?.error_code) {
            return null;
        }
        return `VK API ${parsed.error.error_code}: ${parsed.error.error_msg ?? ''}`.trim();
    } catch {
        return null;
    }
}

function truncate(value: string, max: number): string {
    const s = value.trim();
    return s.length > max ? `${s.slice(0, max)}...` : s;
}

export { parseApiError };
