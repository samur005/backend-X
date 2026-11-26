import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    appendQwdttLineToBase64Subscription,
    buildClientUri,
    buildSubscriptionDocument,
    effectiveHashes,
    envHashOverride,
    normalizeHashes,
    parseHashes,
    stripHash,
    withPeerHost,
} from './qwdtt-links';

describe('stripHash / parseHashes', () => {
    it('extracts a bare hash from vk join URLs', () => {
        assert.equal(stripHash('https://vk.ru/call/join/AbCd123'), 'AbCd123');
        assert.equal(stripHash('https://m.vk.com/call/join/AbCd123?x=1'), 'AbCd123');
        assert.equal(stripHash('https://vk.me/join/AbCd123'), 'AbCd123');
        assert.equal(stripHash('https://example.com/other/AbCd123'), '');
        assert.equal(stripHash('  AbCd123  '), 'AbCd123');
    });

    it('parses a mixed list and caps at 4 unique hashes', () => {
        assert.deepEqual(parseHashes('h1, h2;h1\nh3 h4,h5'), ['h1', 'h2', 'h3', 'h4']);
        assert.equal(normalizeHashes('h1,, h2'), 'h1,h2');
    });
});

describe('env hash override', () => {
    it('wins over stored hashes', () => {
        const env = { QWDTT_VK_HASH: 'pinned' };
        assert.equal(envHashOverride(env), 'pinned');
        assert.equal(effectiveHashes('stored', env), 'pinned');
        assert.equal(effectiveHashes('stored', {}), 'stored');
    });
});

describe('buildClientUri', () => {
    it('renders the 3s-ui qwdtt://config? contract as one line', () => {
        const got = buildClientUri({
            remark: 'Home',
            peer: '1.2.3.4:56000',
            hashes: 'h1,h2',
            workers: 16,
            clientPort: 9000,
            password: 'secret',
        });
        assert.ok(got.startsWith('qwdtt://config?'));
        assert.equal(got.includes('\n'), false);
        for (const want of [
            'name=Home',
            'peer=1.2.3.4%3A56000',
            'pass=secret',
            'hashes=h1%2Ch2',
            'port=9000',
            'workers=16',
        ]) {
            assert.ok(got.includes(want), `missing ${want} in ${got}`);
        }
    });

    it('returns empty when peer or password is missing', () => {
        assert.equal(
            buildClientUri({
                remark: 'x',
                peer: '',
                hashes: 'h',
                workers: 16,
                clientPort: 9000,
                password: 'p',
            }),
            '',
        );
    });
});

describe('subscription document', () => {
    it('matches the Android client JSON contract', () => {
        const doc = buildSubscriptionDocument(
            {
                remark: 'Home',
                peer: '1.2.3.4:56000',
                hashes: 'h1,h2',
                workers: 16,
                clientPort: 9000,
                password: 'secret',
            },
            new Date('2026-11-26T00:00:00Z'),
        );
        assert.deepEqual(doc, {
            subscriptionName: 'Home',
            description: 'qWDTT tunnel via 1.2.3.4:56000',
            version: 1,
            updatedAt: '2026-11-26',
            profiles: [
                {
                    name: 'Home',
                    peer: '1.2.3.4:56000',
                    hashes: 'h1,h2',
                    workers: 16,
                    port: 9000,
                    password: 'secret',
                },
            ],
        });
    });
});

describe('appendQwdttLineToBase64Subscription', () => {
    it('appends exactly one qwdtt line and re-encodes', () => {
        const original = Buffer.from('vless://x@h:443').toString('base64');
        const link = buildClientUri({
            remark: 'Home',
            peer: '1.2.3.4:56000',
            hashes: 'h1',
            workers: 16,
            clientPort: 9000,
            password: 'secret',
        });
        const out = appendQwdttLineToBase64Subscription(original, link);
        const decoded = Buffer.from(out, 'base64').toString('utf8');
        const lines = decoded.split('\n');
        assert.equal(lines.filter((l) => l.startsWith('qwdtt://')).length, 1);
        assert.ok(decoded.includes('vless://x@h:443'));
        const again = appendQwdttLineToBase64Subscription(out, link + '2');
        const decoded2 = Buffer.from(again, 'base64').toString('utf8');
        assert.equal(decoded2.split('\n').filter((l) => l.startsWith('qwdtt://')).length, 1);
        assert.ok(
            decoded2.endsWith('2') || decoded2.includes('secret2') || decoded2.includes(link + '2'),
        );
    });
});

describe('withPeerHost', () => {
    it('adds the DTLS port when only a host is given', () => {
        assert.equal(withPeerHost('example.com', '0.0.0.0:56000'), 'example.com:56000');
        assert.equal(withPeerHost('example.com:1234', '0.0.0.0:56000'), 'example.com:1234');
    });
});
