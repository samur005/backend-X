/**
 * Share-link and hash helpers ported from samur005/3s-ui (GPL-3.0):
 * qwdtt/vkhash.go and qwdtt/config.go (ClientURI, Subscription).
 * Combined work is licensed under AGPL-3.0-only.
 */

export const MAX_HASHES = 4;
export const JOIN_URL_BASE = 'https://vk.ru/call/join/';
export const ENV_VK_HASH = 'QWDTT_VK_HASH';

export interface IQwdttLinkInput {
    remark: string;
    peer: string;
    hashes: string;
    workers: number;
    clientPort: number;
    password: string;
}

export interface IQwdttSubProfile {
    name: string;
    peer: string;
    hashes: string;
    workers: number;
    port: number;
    password: string;
}

export interface IQwdttSubscription {
    subscriptionName: string;
    description?: string;
    version: number;
    updatedAt: string;
    profiles: IQwdttSubProfile[];
}

export function stripHash(raw: string): string {
    let s = raw.trim();
    if (!s) {
        return '';
    }
    const lower = s.toLowerCase();
    const joinIdx = lower.indexOf('/call/join/');
    if (joinIdx >= 0) {
        s = s.slice(joinIdx + '/call/join/'.length);
    } else if (lower.includes('vk.me/join/')) {
        s = s.slice(lower.indexOf('vk.me/join/') + 'vk.me/join/'.length);
    } else if (lower.startsWith('http://') || lower.startsWith('https://')) {
        return '';
    }
    const cut = s.search(/[?#/]/);
    if (cut >= 0) {
        s = s.slice(0, cut);
    }
    return s.replace(/^\/+|\/+$/g, '').trim();
}

export function parseHashes(raw: string): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const part of raw.split(/[,;\s]+/)) {
        const hash = stripHash(part);
        if (!hash || seen.has(hash)) {
            continue;
        }
        seen.add(hash);
        out.push(hash);
        if (out.length >= MAX_HASHES) {
            break;
        }
    }
    return out;
}

export function normalizeHashes(raw: string): string {
    return parseHashes(raw).join(',');
}

export function envHashOverride(env: NodeJS.Dict<string> = process.env): string {
    return normalizeHashes(env[ENV_VK_HASH] ?? '');
}

export function effectiveHashes(stored: string, env: NodeJS.Dict<string> = process.env): string {
    const pinned = envHashOverride(env);
    return pinned || normalizeHashes(stored);
}

export function hashSource(
    stored: string,
    env: NodeJS.Dict<string> = process.env,
): 'env' | 'panel' | 'manual' | '' {
    if (envHashOverride(env)) {
        return 'env';
    }
    return parseHashes(stored).length === 0 ? '' : 'manual';
}

/**
 * One-line qwdtt://config?... link. A second line would be parsed as part of
 * the password and the DTLS handshake would fail. Empty peer or password
 * yields "".
 */
export function buildClientUri(input: IQwdttLinkInput): string {
    const peer = input.peer.trim();
    const password = input.password.trim();
    if (!peer || !password) {
        return '';
    }
    const name = input.remark.trim() || 'qWDTT';
    const query = new URLSearchParams();
    query.set('name', name);
    query.set('peer', peer);
    const hashes = normalizeHashes(input.hashes);
    if (hashes) {
        query.set('hashes', hashes);
    }
    query.set('workers', String(input.workers));
    query.set('port', String(input.clientPort));
    query.set('pass', password);
    return `qwdtt://config?${query.toString()}`;
}

export function buildSubscriptionDocument(
    input: IQwdttLinkInput,
    now: Date = new Date(),
): IQwdttSubscription {
    const peer = input.peer.trim();
    const password = input.password.trim();
    if (!peer) {
        throw new Error('qwdtt: subHost is required for a subscription');
    }
    if (!password) {
        throw new Error('qwdtt: password is required for a subscription');
    }
    const name = input.remark.trim() || 'qWDTT';
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    return {
        subscriptionName: name,
        description: `qWDTT tunnel via ${peer}`,
        version: 1,
        updatedAt: `${y}-${m}-${d}`,
        profiles: [
            {
                name,
                peer,
                hashes: normalizeHashes(input.hashes),
                workers: input.workers,
                port: input.clientPort,
                password,
            },
        ],
    };
}

export function appendQwdttLineToBase64Subscription(body: string, link: string): string {
    if (!link) {
        return body;
    }
    const trimmed = body.trim();
    let decoded = trimmed;
    try {
        const asBuf = Buffer.from(trimmed, 'base64');
        const roundTrip = asBuf.toString('base64').replace(/=+$/, '');
        const original = trimmed.replace(/=+$/, '');
        if (roundTrip === original && !trimmed.startsWith('qwdtt://')) {
            decoded = asBuf.toString('utf8');
        }
    } catch {
        decoded = trimmed;
    }
    const lines = decoded.split(/\r?\n/).filter((line) => line.length > 0);
    if (lines.some((line) => line.startsWith('qwdtt://'))) {
        const without = lines.filter((line) => !line.startsWith('qwdtt://'));
        without.push(link);
        return Buffer.from(without.join('\n')).toString('base64');
    }
    lines.push(link);
    return Buffer.from(lines.join('\n')).toString('base64');
}

export function generatePassword(length = 16): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const limit = 256 - (256 % alphabet.length);
    const out: string[] = [];
    while (out.length < length) {
        const buf = new Uint8Array(length * 2);
        crypto.getRandomValues(buf);
        for (const b of buf) {
            if (b >= limit) {
                continue;
            }
            out.push(alphabet[b % alphabet.length]);
            if (out.length === length) {
                break;
            }
        }
    }
    return out.join('');
}

export function dtlsPort(listenAddr: string): number {
    const idx = listenAddr.lastIndexOf(':');
    if (idx < 0) {
        return 56000;
    }
    const port = Number(listenAddr.slice(idx + 1));
    return Number.isInteger(port) && port > 0 ? port : 56000;
}

export function withPeerHost(host: string, listenAddr: string): string {
    const trimmed = host.trim();
    if (!trimmed) {
        return '';
    }
    if (trimmed.includes(':') && !trimmed.startsWith('[')) {
        // already host:port (or IPv6 without brackets — leave as provided)
        const last = trimmed.lastIndexOf(':');
        const maybePort = Number(trimmed.slice(last + 1));
        if (Number.isInteger(maybePort) && maybePort > 0) {
            return trimmed;
        }
    }
    const hostname = trimmed.replace(/^\[/, '').replace(/\]$/, '');
    const needsBrackets = hostname.includes(':');
    const left = needsBrackets ? `[${hostname}]` : hostname;
    return `${left}:${dtlsPort(listenAddr)}`;
}
