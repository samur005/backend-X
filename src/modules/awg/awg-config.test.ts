/**
 * Subnet, port and option checks from samur005/3s-ui wgserver/store.go.
 * Combined Remnawave X work is AGPL-3.0-only.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    DEFAULT_AWG_PORT,
    effectiveMtu,
    normalizeAllowedIps,
    normalizeDns,
    pickListenPort,
    pickSubnet,
    prefixesOverlap,
    serverAddressFromSubnet,
    validateKeepalive,
    validateListenPort,
    validateMtu,
    validateSubnet,
} from './awg-config';

describe('awg config (3s-ui wgserver/store.go)', () => {
    it('subnet prefix must be 16-29 IPv4', () => {
        assert.equal(validateSubnet('10.8.1.0/24'), null);
        assert.equal(validateSubnet('10.9.0.0/29'), null);
        assert.equal(validateSubnet('10.8.0.0/16'), null);
        assert.notEqual(validateSubnet('nonsense'), null);
        assert.notEqual(validateSubnet('10.8.0.0/8'), null);
        assert.notEqual(validateSubnet('10.8.0.0/31'), null);
        assert.notEqual(validateSubnet('2001:db8::/32'), null);
    });

    it('first address of the subnet is the server', () => {
        assert.equal(serverAddressFromSubnet('10.8.1.0/24'), '10.8.1.1');
        assert.equal(serverAddressFromSubnet('10.9.0.0/29'), '10.9.0.1');
    });

    it('pickPort starts at 51820 and takes the next free port', () => {
        assert.equal(pickListenPort([]), DEFAULT_AWG_PORT);
        assert.equal(pickListenPort([51820, 51821]), 51822);
    });

    it('pickSubnet takes the first free 10.8.N.0/24', () => {
        assert.equal(pickSubnet([]), '10.8.1.0/24');
        assert.equal(pickSubnet(['10.8.1.0/24', '10.8.2.0/24']), '10.8.3.0/24');
        assert.equal(prefixesOverlap('10.8.1.0/24', '10.8.1.128/25'), true);
        assert.equal(prefixesOverlap('10.8.1.0/24', '10.8.2.0/24'), false);
    });

    it('mtu keepalive dns and allowed ips', () => {
        assert.equal(validateMtu(0), null);
        assert.equal(validateMtu(1420), null);
        assert.notEqual(validateMtu(500), null);
        assert.equal(validateKeepalive(25), null);
        assert.notEqual(validateKeepalive(3601), null);
        assert.equal(normalizeDns('1.1.1.1, 8.8.8.8').value, '1.1.1.1, 8.8.8.8');
        assert.notEqual(normalizeDns('example.com').error, null);
        assert.equal(normalizeAllowedIps('0.0.0.0/0, ::/0').error, null);
        assert.notEqual(normalizeAllowedIps('not-a-net').error, null);
        assert.notEqual(validateListenPort(0), null);
        assert.notEqual(validateListenPort(70000), null);
        assert.equal(effectiveMtu(0, 20), 1400);
        assert.equal(effectiveMtu(1280, 20), 1280);
    });
});
