import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { QwdttVkClient, type VkPoster } from './qwdtt-vk';

function poster(map: Record<string, unknown>): VkPoster {
    return async (endpoint) => {
        const key = Object.keys(map).find((k) => endpoint.includes(k));
        if (!key) {
            throw new Error(`unexpected endpoint ${endpoint}`);
        }
        return JSON.stringify(map[key]);
    };
}

describe('parseCookies', () => {
    const vk = new QwdttVkClient();

    it('accepts a Cookie header and a JSON export, and requires remixsid', () => {
        const json = vk.parseCookies('remixsid=abc; remixlang=0');
        assert.deepEqual(JSON.parse(json), [
            { name: 'remixsid', value: 'abc' },
            { name: 'remixlang', value: '0' },
        ]);
        const again = vk.parseCookies(json);
        assert.equal(again, json);
        assert.throws(() => vk.parseCookies('remixlang=0'), /remixsid/);
        assert.throws(() => vk.parseCookies(''), /empty/);
    });
});

describe('createCall / callAlive', () => {
    it('starts a call and reads the hash from the join link', async () => {
        const vk = new QwdttVkClient(
            poster({
                'act=web_token': { data: { access_token: 'tok' } },
                'method/users.get': { response: [{ id: 42 }] },
                'method/calls.start': {
                    response: { call_id: 'c1', join_link: 'https://vk.ru/call/join/AbCd' },
                },
            }),
        );
        const call = await vk.createCall(JSON.stringify([{ name: 'remixsid', value: 'x' }]));
        assert.equal(call.hash, 'AbCd');
        assert.equal(call.callId, 'c1');
    });

    it('treats a VK API error on getCallPreview as a dead call, not a transport error', async () => {
        const vk = new QwdttVkClient(
            poster({
                'act=get_anonym_token': { data: { access_token: 'anon' } },
                'method/calls.getCallPreview': {
                    error: { error_code: 104, error_msg: 'not found' },
                },
            }),
        );
        assert.equal(await vk.callAlive('AbCd'), false);
    });

    it('treats a live preview as alive', async () => {
        const vk = new QwdttVkClient(
            poster({
                'act=get_anonym_token': { data: { access_token: 'anon' } },
                'method/calls.getCallPreview': {
                    response: { ok_join_link: 'https://vk.ru/call/join/AbCd' },
                },
            }),
        );
        assert.equal(await vk.callAlive('AbCd'), true);
    });
});
