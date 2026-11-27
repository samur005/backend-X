/**
 * AmneziaWG obfuscation Generate / Validate / Fields, ported from
 * samur005/3s-ui wgserver/version.go (GPL-3.0). Combined Remnawave X work
 * is AGPL-3.0-only. Do not copy LucX / PolyForm Noncommercial sources.
 */

import { randomBytes, randomInt } from 'node:crypto';

export const AWG_VERSIONS = ['1.0', '1.5', '2.0', '2.5', '3.0', '3.1'] as const;
export type TAwgVersion = (typeof AWG_VERSIONS)[number];
export const DEFAULT_AWG_VERSION: TAwgVersion = '2.0';

export function isValidAwgVersion(version: string): version is TAwgVersion {
    return (AWG_VERSIONS as readonly string[]).includes(version);
}

export interface IAwgFieldSet {
    base: boolean;
    cps: boolean;
    s34: boolean;
    hRange: boolean;
    protection: boolean;
    trailersCookie: boolean;
}

export interface IAwgObfuscation {
    jc: number;
    jmin: number;
    jmax: number;
    s1: number;
    s2: number;
    s3: number;
    s4: number;
    h1: string;
    h2: string;
    h3: string;
    h4: string;
    i1: string;
    i2: string;
    i3: string;
    i4: string;
    i5: string;
    headerProtectionKey: string;
    contentPaddingAddition: string;
    rekeyAfterTime: string;
    rekeyTimeout: string;
    rejectAfterTime: string;
    keepaliveTimeout: string;
    maxHandshakeAttempts: string;
    randomTrailers: boolean;
    disableCookies: boolean;
}

export function emptyObfuscation(): IAwgObfuscation {
    return {
        jc: 0,
        jmin: 0,
        jmax: 0,
        s1: 0,
        s2: 0,
        s3: 0,
        s4: 0,
        h1: '',
        h2: '',
        h3: '',
        h4: '',
        i1: '',
        i2: '',
        i3: '',
        i4: '',
        i5: '',
        headerProtectionKey: '',
        contentPaddingAddition: '',
        rekeyAfterTime: '',
        rekeyTimeout: '',
        rejectAfterTime: '',
        keepaliveTimeout: '',
        maxHandshakeAttempts: '',
        randomTrailers: false,
        disableCookies: false,
    };
}

export function obfuscationEquals(a: IAwgObfuscation, b: IAwgObfuscation): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

function level(version: string): number {
    switch (version) {
        case '1.0':
            return 0;
        case '1.5':
            return 1;
        case '2.0':
        case '2.5':
            return 2;
        case '3.0':
            return 3;
        case '3.1':
            return 4;
        default:
            return 2;
    }
}

export function awgFields(version: string): IAwgFieldSet {
    const featureLevel = level(version);
    return {
        base: true,
        cps: featureLevel >= 1,
        s34: featureLevel >= 2,
        hRange: featureLevel >= 2 && featureLevel < 3,
        protection: featureLevel >= 3,
        trailersCookie: featureLevel >= 4,
    };
}

export function pruneObfuscation(input: IAwgObfuscation, version: string): IAwgObfuscation {
    const fields = awgFields(version);
    const next: IAwgObfuscation = { ...input };
    if (!fields.cps) {
        next.i1 = '';
        next.i2 = '';
        next.i3 = '';
        next.i4 = '';
        next.i5 = '';
    }
    if (!fields.s34) {
        next.s3 = 0;
        next.s4 = 0;
    }
    if (!fields.protection) {
        next.headerProtectionKey = '';
        next.contentPaddingAddition = '';
        next.rekeyAfterTime = '';
        next.rekeyTimeout = '';
        next.rejectAfterTime = '';
        next.keepaliveTimeout = '';
        next.maxHandshakeAttempts = '';
    }
    if (!fields.trailersCookie) {
        next.randomTrailers = false;
        next.disableCookies = false;
    }
    return next;
}

// Caps generated magic headers at 2^31-1: the protocol allows the full uint32,
// but some clients' editors reject anything above.
const H_MAX = 2147483647;

function randInt(lo: number, hi: number): number {
    if (hi <= lo) {
        return lo;
    }
    return randomInt(lo, hi + 1);
}

export function generateAwgKey(): string {
    return randomBytes(32).toString('base64');
}

export function generateObfuscation(version: string): IAwgObfuscation {
    const fields = awgFields(version);
    const obfuscation = emptyObfuscation();
    obfuscation.jc = randInt(3, 6);
    obfuscation.jmin = randInt(40, 89);
    obfuscation.jmax = obfuscation.jmin + randInt(50, 250);
    obfuscation.s1 = randInt(15, 150);
    obfuscation.s2 = randInt(15, 150);
    while (obfuscation.s1 + 56 === obfuscation.s2) {
        obfuscation.s2 = randInt(15, 150);
    }
    if (fields.s34) {
        obfuscation.s3 = randInt(12, 55);
        obfuscation.s4 = randInt(12, 27);
    }
    const lo = 5;
    const band = Math.floor((H_MAX - lo + 1) / 4);
    const headers: string[] = [];
    for (let i = 0; i < 4; i++) {
        const bandLo = lo + i * band;
        const bandHi = bandLo + band - 1;
        if (fields.hRange) {
            const start = randInt(bandLo, bandHi - 1000000);
            const end = start + randInt(1000, 900000);
            headers[i] = `${start}-${end}`;
        } else {
            headers[i] = String(randInt(bandLo, bandHi));
        }
    }
    obfuscation.h1 = headers[0];
    obfuscation.h2 = headers[1];
    obfuscation.h3 = headers[2];
    obfuscation.h4 = headers[3];
    if (fields.cps) {
        obfuscation.i1 = `<r ${randInt(32, 256)}>`;
    }
    if (fields.protection) {
        obfuscation.s3 = Math.max(obfuscation.s3, 12);
        obfuscation.s4 = Math.max(obfuscation.s4, 12);
        obfuscation.headerProtectionKey = generateAwgKey();
        const contentPadding = randInt(8, 24);
        obfuscation.contentPaddingAddition = `${contentPadding}-${contentPadding + randInt(8, 40)}`;
        const rekey = randInt(100, 120);
        const rekeyHi = rekey + randInt(10, 40);
        obfuscation.rekeyAfterTime = `${rekey}-${rekeyHi}`;
        const reject = rekeyHi + randInt(30, 60);
        obfuscation.rejectAfterTime = `${reject}-${reject + randInt(30, 90)}`;
        const rekeyTimeout = randInt(3, 6);
        obfuscation.rekeyTimeout = `${rekeyTimeout}-${rekeyTimeout + randInt(1, 4)}`;
        const keepalive = randInt(8, 12);
        obfuscation.keepaliveTimeout = `${keepalive}-${keepalive + randInt(2, 8)}`;
        const handshakeAttempts = randInt(15, 25);
        obfuscation.maxHandshakeAttempts = `${handshakeAttempts}-${handshakeAttempts + randInt(5, 25)}`;
    }
    if (fields.trailersCookie) {
        obfuscation.randomTrailers = true;
        obfuscation.disableCookies = true;
    }
    return pruneObfuscation(obfuscation, version);
}

export function fillMissingObfuscation(input: IAwgObfuscation, version: string): IAwgObfuscation {
    let next = pruneObfuscation(input, version);
    const generated = generateObfuscation(version);
    const fields = awgFields(version);
    if (next.jc === 0 && next.jmin === 0 && next.jmax === 0) {
        next.jc = generated.jc;
        next.jmin = generated.jmin;
        next.jmax = generated.jmax;
    }
    if (next.s1 === 0 && next.s2 === 0) {
        next.s1 = generated.s1;
        next.s2 = generated.s2;
    }
    if (fields.s34 && next.s3 === 0 && next.s4 === 0) {
        next.s3 = generated.s3;
        next.s4 = generated.s4;
    }
    if (next.h1 === '' && next.h2 === '' && next.h3 === '' && next.h4 === '') {
        next.h1 = generated.h1;
        next.h2 = generated.h2;
        next.h3 = generated.h3;
        next.h4 = generated.h4;
    }
    if (!fields.hRange) {
        for (const key of ['h1', 'h2', 'h3', 'h4'] as const) {
            const parsed = parseRange(next[key]);
            if (parsed && next[key].includes('-')) {
                next[key] = String(parsed.lo);
            }
        }
    }
    if (
        fields.cps &&
        next.i1 === '' &&
        next.i2 === '' &&
        next.i3 === '' &&
        next.i4 === '' &&
        next.i5 === ''
    ) {
        next.i1 = generated.i1;
    }
    if (fields.protection) {
        if (next.headerProtectionKey === '') {
            next.headerProtectionKey = generated.headerProtectionKey;
        }
        if (next.s1 < 12 || next.s2 < 12 || next.s3 < 12 || next.s4 < 12) {
            next.s1 = Math.max(next.s1, 12);
            next.s2 = Math.max(next.s2, 12);
            next.s3 = Math.max(next.s3, 12);
            next.s4 = Math.max(next.s4, 12);
            while (next.s1 + 56 === next.s2) {
                next.s2 += 1;
            }
        }
        const fill = (key: keyof IAwgObfuscation, value: string): void => {
            if (next[key] === '') {
                (next[key] as string) = value;
            }
        };
        fill('contentPaddingAddition', generated.contentPaddingAddition);
        fill('rekeyAfterTime', generated.rekeyAfterTime);
        fill('rekeyTimeout', generated.rekeyTimeout);
        fill('rejectAfterTime', generated.rejectAfterTime);
        fill('keepaliveTimeout', generated.keepaliveTimeout);
        fill('maxHandshakeAttempts', generated.maxHandshakeAttempts);
    }
    return next;
}

const H_MAX_VALID = 4294967295n;

// Padded handshake packets (148+S1, 92+S2, 64+S3 bytes) have to fit the
// smallest receive buffer the engine has (1700 bytes on iOS).
const MAX_S1 = 1700 - 148;
const MAX_S2 = 1700 - 92;
const MAX_S3 = 1700 - 64;

export function parseRange(value: string): { lo: bigint; hi: bigint } | null {
    const trimmed = value.trim();
    if (trimmed === '') {
        return null;
    }
    const dash = trimmed.indexOf('-');
    if (dash !== -1) {
        const lo = parseBigInt(trimmed.slice(0, dash).trim());
        const hi = parseBigInt(trimmed.slice(dash + 1).trim());
        if (lo === null || hi === null) {
            return null;
        }
        return { lo, hi };
    }
    const number = parseBigInt(trimmed);
    if (number === null) {
        return null;
    }
    return { lo: number, hi: number };
}

function parseBigInt(value: string): bigint | null {
    if (!/^-?\d+$/.test(value)) {
        return null;
    }
    try {
        return BigInt(value);
    } catch {
        return null;
    }
}

function noControl(name: string, value: string): string | null {
    for (const char of value) {
        const code = char.codePointAt(0) ?? 0;
        if (code < 0x20 || code === 0x7f) {
            return `${name} must not contain control characters`;
        }
    }
    return null;
}

function checkRange(
    name: string,
    value: string,
    minAllowed: bigint,
    singleOnly: boolean,
): string | null {
    if (value.trim() === '') {
        return null;
    }
    const controlError = noControl(name, value);
    if (controlError) {
        return controlError;
    }
    const parsed = parseRange(value);
    if (!parsed) {
        return `${name}: ${JSON.stringify(value)} must be a number or a low-high range`;
    }
    if (singleOnly && value.includes('-')) {
        return `${name}: ${JSON.stringify(value)} must be a single number in this version`;
    }
    if (parsed.lo < minAllowed || parsed.hi > H_MAX_VALID || parsed.lo > parsed.hi) {
        return `${name}: ${JSON.stringify(value)} must satisfy ${minAllowed} <= low <= high <= ${H_MAX_VALID}`;
    }
    return null;
}

const CHAIN_TAGS = new Set(['b', 't', 'r', 'rc', 'rd', 'd', 'ds', 'dz']);
const NEGATIVE_COUNT = /<\s*(r|rc|rd|dz)\s+-\d+\s*>?/;
const KERNEL_ONLY_TAG = /<\s*c\s*>?/;

function checkChain(name: string, spec: string): string | null {
    if (spec.trim() === '') {
        return null;
    }
    const controlError = noControl(name, spec);
    if (controlError) {
        return controlError;
    }
    const negative = NEGATIVE_COUNT.exec(spec);
    if (negative) {
        return `${name}: ${negative[0]} has a negative count`;
    }
    const kernelOnly = KERNEL_ONLY_TAG.exec(spec);
    if (kernelOnly) {
        return `${name}: ${kernelOnly[0]} is a kernel-only tag`;
    }
    let rest = spec;
    for (;;) {
        const start = rest.indexOf('<');
        if (start === -1) {
            return null;
        }
        const end = rest.indexOf('>', start);
        if (end === -1) {
            return `${name}: ${JSON.stringify(spec)} is missing a closing '>'`;
        }
        const fields = rest
            .slice(start + 1, end)
            .trim()
            .split(/\s+/)
            .filter(Boolean);
        if (fields.length === 0) {
            return `${name}: ${JSON.stringify(spec)} has an empty <> tag`;
        }
        if (!CHAIN_TAGS.has(fields[0])) {
            return `${name}: ${JSON.stringify(spec)} uses unknown tag <${fields[0]}>`;
        }
        rest = rest.slice(end + 1);
    }
}

export function validateObfuscation(obfuscation: IAwgObfuscation, version: string): string | null {
    const fields = awgFields(version);
    if (obfuscation.jc < 0 || obfuscation.jc > 128) {
        return `Jc ${obfuscation.jc} must be 0..128`;
    }
    if (
        obfuscation.jmin < 0 ||
        obfuscation.jmax < 0 ||
        obfuscation.jmax > 1280 ||
        obfuscation.jmin > obfuscation.jmax
    ) {
        return `Jmin/Jmax: need 0 <= Jmin (${obfuscation.jmin}) <= Jmax (${obfuscation.jmax}) <= 1280`;
    }
    const sizes: Array<[string, number, number]> = [
        ['S1', obfuscation.s1, MAX_S1],
        ['S2', obfuscation.s2, MAX_S2],
        ['S3', obfuscation.s3, MAX_S3],
    ];
    for (const [name, value, max] of sizes) {
        if (value < 0 || value > max) {
            return `${name} ${value} must be 0..${max}`;
        }
    }
    if (obfuscation.s4 < 0 || obfuscation.s4 > 32) {
        return `S4 ${obfuscation.s4} must be 0..32`;
    }
    if (obfuscation.s1 + 56 === obfuscation.s2) {
        return `S1+56 must not equal S2 (${obfuscation.s1}+56 == ${obfuscation.s2})`;
    }
    const headers = [obfuscation.h1, obfuscation.h2, obfuscation.h3, obfuscation.h4];
    const lows: bigint[] = [];
    const highs: bigint[] = [];
    for (let i = 0; i < 4; i++) {
        const rangeError = checkRange(`H${i + 1}`, headers[i], 1n, !fields.hRange);
        if (rangeError) {
            return rangeError;
        }
        const parsed = parseRange(headers[i]);
        if (!parsed) {
            // A blank header keeps WireGuard's own type number.
            lows[i] = BigInt(i + 1);
            highs[i] = BigInt(i + 1);
        } else {
            lows[i] = parsed.lo;
            highs[i] = parsed.hi;
        }
    }
    for (let i = 0; i < 4; i++) {
        for (let j = i + 1; j < 4; j++) {
            if (lows[i] <= highs[j] && lows[j] <= highs[i]) {
                return `H${i + 1} and H${j + 1} overlap`;
            }
        }
    }
    const chains = [obfuscation.i1, obfuscation.i2, obfuscation.i3, obfuscation.i4, obfuscation.i5];
    for (let i = 0; i < chains.length; i++) {
        const chainError = checkChain(`I${i + 1}`, chains[i]);
        if (chainError) {
            return chainError;
        }
    }
    if (obfuscation.headerProtectionKey !== '') {
        const controlError = noControl('headerProtectionKey', obfuscation.headerProtectionKey);
        if (controlError) {
            return controlError;
        }
        let decoded: Buffer | null = null;
        try {
            decoded = Buffer.from(obfuscation.headerProtectionKey, 'base64');
        } catch {
            decoded = null;
        }
        if (!decoded || decoded.length !== 32) {
            return 'headerProtectionKey must be a base64 32-byte key';
        }
        const pads = [obfuscation.s1, obfuscation.s2, obfuscation.s3, obfuscation.s4];
        for (let i = 0; i < pads.length; i++) {
            if (pads[i] < 12) {
                return `S${i + 1} ${pads[i]}: header protection needs S1-S4 >= 12`;
            }
        }
    }
    const paddingError = checkRange(
        'contentPaddingAddition',
        obfuscation.contentPaddingAddition,
        0n,
        false,
    );
    if (paddingError) {
        return paddingError;
    }
    const timers: Array<[string, string]> = [
        ['rekeyAfterTime', obfuscation.rekeyAfterTime],
        ['rekeyTimeout', obfuscation.rekeyTimeout],
        ['rejectAfterTime', obfuscation.rejectAfterTime],
        ['keepaliveTimeout', obfuscation.keepaliveTimeout],
        ['maxHandshakeAttempts', obfuscation.maxHandshakeAttempts],
    ];
    for (const [name, value] of timers) {
        const timerError = checkRange(name, value, 1n, false);
        if (timerError) {
            return timerError;
        }
    }
    // A session has to renew before it is dropped: every rekey time below every
    // reject time. A blank side means WireGuard's own 120s / 180s.
    if (obfuscation.rekeyAfterTime !== '' || obfuscation.rejectAfterTime !== '') {
        let rekeyHi = 120n;
        let rejectLo = 180n;
        if (obfuscation.rekeyAfterTime !== '') {
            const parsed = parseRange(obfuscation.rekeyAfterTime);
            if (parsed) {
                rekeyHi = parsed.hi;
            }
        }
        if (obfuscation.rejectAfterTime !== '') {
            const parsed = parseRange(obfuscation.rejectAfterTime);
            if (parsed) {
                rejectLo = parsed.lo;
            }
        }
        if (rekeyHi >= rejectLo) {
            return `rekeyAfterTime max ${rekeyHi} must be below rejectAfterTime min ${rejectLo}`;
        }
    }
    return null;
}
