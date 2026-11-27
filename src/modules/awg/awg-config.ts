/**
 * AmneziaWG config defaults and instance validation, ported from
 * samur005/3s-ui wgserver/config.go and store.go (GPL-3.0). Combined
 * Remnawave X work is AGPL-3.0-only. Do not copy LucX / PolyForm
 * Noncommercial sources.
 */

import { isIP } from 'node:net';

import { DEFAULT_AWG_VERSION, isValidAwgVersion } from './awg-version';

export const DEFAULT_AWG_PORT = 51820;
export const DEFAULT_AWG_MTU = 1420;
export const DEFAULT_AWG_KEEPALIVE = 25;
export const DEFAULT_AWG_DNS = '1.1.1.1, 8.8.8.8';
export const DEFAULT_AWG_ALLOWED_IPS = '0.0.0.0/0, ::/0';
export const AWG_SUBNET_PREFIX_MIN = 16;
export const AWG_SUBNET_PREFIX_MAX = 29;

export { DEFAULT_AWG_VERSION };

export function splitList(value: string): string[] {
    return value.split(/[,; \n\t]+/).filter(Boolean);
}

export function parseIpv4Prefix(subnet: string): { network: string; bits: number } | null {
    const trimmed = subnet.trim();
    const match = /^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/.exec(trimmed);
    if (!match) {
        return null;
    }
    const bits = Number(match[2]);
    if (!Number.isInteger(bits) || bits < 0 || bits > 32) {
        return null;
    }
    const octets = match[1].split('.').map((part) => Number(part));
    if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
        return null;
    }
    const mask = bits === 0 ? 0 : bits === 32 ? 0xffffffff : ~((1 << (32 - bits)) - 1) >>> 0;
    const ip = ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
    const networkInt = (ip & mask) >>> 0;
    const network = [
        (networkInt >>> 24) & 0xff,
        (networkInt >>> 16) & 0xff,
        (networkInt >>> 8) & 0xff,
        networkInt & 0xff,
    ].join('.');
    return { network: `${network}/${bits}`, bits };
}

export function serverAddressFromSubnet(subnet: string): string | null {
    const prefix = parseIpv4Prefix(subnet);
    if (!prefix) {
        return null;
    }
    const [a, b, c, d] = prefix.network.split('/')[0].split('.').map(Number);
    const next = ((a << 24) | (b << 16) | (c << 8) | d) + 1;
    return `${(next >>> 24) & 0xff}.${(next >>> 16) & 0xff}.${(next >>> 8) & 0xff}.${next & 0xff}`;
}

export function prefixesOverlap(left: string, right: string): boolean {
    const a = parseIpv4Prefix(left);
    const b = parseIpv4Prefix(right);
    if (!a || !b) {
        return false;
    }
    const toInt = (value: string): number => {
        const [w, x, y, z] = value.split('/')[0].split('.').map(Number);
        return ((w << 24) | (x << 16) | (y << 8) | z) >>> 0;
    };
    const aStart = toInt(a.network);
    const bStart = toInt(b.network);
    const aMask = a.bits === 0 ? 0 : a.bits === 32 ? 0xffffffff : ~((1 << (32 - a.bits)) - 1) >>> 0;
    const bMask = b.bits === 0 ? 0 : b.bits === 32 ? 0xffffffff : ~((1 << (32 - b.bits)) - 1) >>> 0;
    return (aStart & bMask) === bStart || (bStart & aMask) === aStart;
}

export function validateListenPort(port: number): string | null {
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return `port ${port} is out of range`;
    }
    return null;
}

export function pickListenPort(used: Iterable<number>, start = DEFAULT_AWG_PORT): number {
    const taken = new Set(used);
    let port = start;
    while (taken.has(port)) {
        port += 1;
    }
    return port;
}

export function validateSubnet(subnet: string): string | null {
    const prefix = parseIpv4Prefix(subnet);
    if (!prefix) {
        return `subnet ${JSON.stringify(subnet)} must be an IPv4 network such as 10.8.1.0/24`;
    }
    if (prefix.bits < AWG_SUBNET_PREFIX_MIN || prefix.bits > AWG_SUBNET_PREFIX_MAX) {
        return `subnet ${JSON.stringify(prefix.network)}: the prefix length must be between 16 and 29`;
    }
    return null;
}

export function pickSubnet(used: Iterable<string>): string | null {
    const occupied = [...used];
    for (let n = 1; n < 250; n++) {
        const candidate = `10.8.${n}.0/24`;
        if (!occupied.some((other) => prefixesOverlap(candidate, other))) {
            return candidate;
        }
    }
    return null;
}

export function validateMtu(mtu: number): string | null {
    if (mtu !== 0 && (mtu < 576 || mtu > 1500)) {
        return `MTU ${mtu} must be 0 (automatic) or between 576 and 1500`;
    }
    return null;
}

export function validateKeepalive(keepalive: number): string | null {
    if (!Number.isInteger(keepalive) || keepalive < 0 || keepalive > 3600) {
        return `keepalive ${keepalive} must be 0..3600 seconds`;
    }
    return null;
}

export function normalizeDns(dns: string): { value: string; error: string | null } {
    const parts = splitList(dns);
    for (const part of parts) {
        if (!isIP(part)) {
            return { value: dns, error: `DNS ${JSON.stringify(part)} is not an IP address` };
        }
    }
    return { value: parts.join(', '), error: null };
}

function isNetwork(value: string): boolean {
    const slash = value.lastIndexOf('/');
    if (slash === -1) {
        return false;
    }
    const addr = value.slice(0, slash);
    const bits = Number(value.slice(slash + 1));
    if (!Number.isInteger(bits) || bits < 0) {
        return false;
    }
    const version = isIP(addr);
    if (version === 4) {
        return bits <= 32 && parseIpv4Prefix(value) !== null;
    }
    if (version === 6) {
        return bits <= 128;
    }
    return false;
}

export function normalizeAllowedIps(allowedIps: string): { value: string; error: string | null } {
    const parts = splitList(allowedIps);
    const list = parts.length === 0 ? splitList(DEFAULT_AWG_ALLOWED_IPS) : parts;
    for (const part of list) {
        if (!isNetwork(part)) {
            return {
                value: allowedIps,
                error: `allowed IPs: ${JSON.stringify(part)} is not a network such as 0.0.0.0/0`,
            };
        }
    }
    return { value: list.join(', '), error: null };
}

export function validateEndpoint(endpoint: string): string | null {
    const trimmed = endpoint.trim();
    if (trimmed === '') {
        return null;
    }
    for (const char of trimmed) {
        const code = char.codePointAt(0) ?? 0;
        if (code < 0x20 || code === 0x7f) {
            return 'endpoint must not contain control characters';
        }
    }
    if (/[ \t/?#@]/.test(trimmed) || trimmed.length > 255) {
        return `endpoint ${JSON.stringify(trimmed)} must be a host or host:port`;
    }
    return null;
}

export function validateInstanceVersion(version: string): string | null {
    const trimmed = version.trim() === '' ? DEFAULT_AWG_VERSION : version.trim();
    if (!isValidAwgVersion(trimmed)) {
        return `AmneziaWG version ${JSON.stringify(version)} is not one of ${AWG_VERSIONS_LIST}`;
    }
    return null;
}

const AWG_VERSIONS_LIST = '1.0, 1.5, 2.0, 2.5, 3.0, 3.1';

export function effectiveMtu(mtu: number, s4: number): number {
    if (mtu > 0) {
        return mtu;
    }
    return Math.max(DEFAULT_AWG_MTU - Math.max(s4, 0), 1280);
}
