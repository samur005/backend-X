import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    appendQwdttLineToBase64Subscription,
    buildClientUri,
    buildSubscriptionDocument,
    buildSubscriptionDocumentForProfiles,
    effectiveHashes,
    envHashOverride,
    normalizeHashes,
    parseHashes,
    stripHash,
    withPeerHost,
    isPrivateOrLocalPeerHost,
    peerHostname,
    resolveQwdttHostPeer,
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

    it('builds one document with a profile per host', () => {
        const doc = buildSubscriptionDocumentForProfiles(
            [
                {
                    remark: 'Germany',
                    peer: 'de.example.com:56000',
                    hashes: 'h1',
                    workers: 16,
                    clientPort: 9000,
                    password: 'secret',
                },
                {
                    remark: 'Finland',
                    peer: 'fi.example.com:56000',
                    hashes: 'h1',
                    workers: 16,
                    clientPort: 9000,
                    password: 'secret',
                },
            ],
            new Date('2026-11-26T00:00:00Z'),
        );
        assert.equal(doc?.subscriptionName, 'qWDTT');
        assert.equal(doc?.profiles.length, 2);
        assert.equal(doc?.profiles[0].name, 'Germany');
        assert.equal(doc?.profiles[1].peer, 'fi.example.com:56000');
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

    it('appends several qWDTT hosts and replaces previous qWDTT lines', () => {
        const original = Buffer.from('vless://example\n').toString('base64');
        const links = [
            'qwdtt://config?name=Germany&peer=de.example.com:56000',
            'qwdtt://config?name=Finland&peer=fi.example.com:56000',
        ];
        const out = appendQwdttLineToBase64Subscription(original, links);
        const decoded = Buffer.from(out, 'base64').toString('utf8');
        assert.ok(decoded.includes('vless://example'));
        assert.ok(decoded.includes('name=Germany'));
        assert.ok(decoded.includes('name=Finland'));
        const again = appendQwdttLineToBase64Subscription(out, [
            'qwdtt://config?name=Netherlands&peer=nl.example.com:56000',
        ]);
        const decodedAgain = Buffer.from(again, 'base64').toString('utf8');
        assert.ok(decodedAgain.includes('vless://example'));
        assert.ok(decodedAgain.includes('name=Netherlands'));
        assert.equal(decodedAgain.includes('name=Germany'), false);
        assert.equal(
            decodedAgain.split(/\r?\n/).filter((line) => line.startsWith('qwdtt://')).length,
            1,
        );
    });
});

describe('withPeerHost', () => {
    it('adds the DTLS port when only a host is given', () => {
        assert.equal(withPeerHost('example.com', '0.0.0.0:56000'), 'example.com:56000');
        assert.equal(withPeerHost('example.com:1234', '0.0.0.0:56000'), 'example.com:1234');
    });
});

describe('isPrivateOrLocalPeerHost', () => {
    it('treats docker-bridge and RFC1918 addresses as unusable automatic peers', () => {
        assert.equal(isPrivateOrLocalPeerHost('172.30.0.1'), true);
        assert.equal(isPrivateOrLocalPeerHost('172.30.0.1:56000'), true);
        assert.equal(isPrivateOrLocalPeerHost('10.0.0.5'), true);
        assert.equal(isPrivateOrLocalPeerHost('192.168.1.2'), true);
        assert.equal(isPrivateOrLocalPeerHost('127.0.0.1'), true);
        assert.equal(isPrivateOrLocalPeerHost('localhost'), true);
        assert.equal(isPrivateOrLocalPeerHost('::1'), true);
        assert.equal(isPrivateOrLocalPeerHost('fd00::1'), true);
    });

    it('keeps public hostnames and addresses', () => {
        assert.equal(isPrivateOrLocalPeerHost('node.example.com'), false);
        assert.equal(isPrivateOrLocalPeerHost('node.144.31.53.140.sslip.io:56000'), false);
        assert.equal(isPrivateOrLocalPeerHost('144.31.53.140'), false);
        assert.equal(peerHostname('node.example.com:56000'), 'node.example.com');
    });
});

describe('resolveQwdttHostPeer', () => {
    const base = { listenAddr: '0.0.0.0:56000', subHost: 'global.example.com' };
    it('prefers the host address', () => {
        assert.deepEqual(
            resolveQwdttHostPeer({ ...base, hostAddress: 'de.example.com', hostPort: 56000, nodeAddress: '1.1.1.1' }),
            { peer: 'de.example.com:56000', source: 'host' },
        );
    });
    it('rejects a private host address instead of falling back', () => {
        assert.equal(
            resolveQwdttHostPeer({ ...base, hostAddress: '172.30.0.1', hostPort: 56000, nodeAddress: '1.1.1.1' }),
            null,
        );
    });
    it('uses the public node address when the host address is empty', () => {
        assert.deepEqual(
            resolveQwdttHostPeer({ ...base, hostAddress: '', hostPort: 0, nodeAddress: '144.31.53.140' }),
            { peer: '144.31.53.140:56000', source: 'node' },
        );
    });
    it('falls back to subHost when the node address is private', () => {
        assert.deepEqual(
            resolveQwdttHostPeer({ ...base, hostAddress: '', hostPort: 56000, nodeAddress: '172.30.0.1' }),
            { peer: 'global.example.com:56000', source: 'subHost' },
        );
    });
    it('returns null when nothing public is left', () => {
        assert.equal(
            resolveQwdttHostPeer({ listenAddr: '0.0.0.0:56000', subHost: '', hostAddress: '', hostPort: 56000, nodeAddress: '10.0.0.2' }),
            null,
        );
    });
});
