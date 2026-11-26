import { QwdttSettings } from '@prisma/client';

import { Injectable, Logger } from '@nestjs/common';

import { AxiosService } from '@common/axios';
import { INodeConnectionOpts } from '@common/axios/axios.interfaces';
import { INodeQwdttSyncRequest } from '@common/axios/qwdtt-node.contract';
import { fail, ok, TResult } from '@common/types';
import {
    CheckQwdttCookiesCommand,
    GenerateQwdttHashCommand,
    GetQwdttCommand,
    GetQwdttUserLinkCommand,
    GetQwdttUsersCommand,
    UpdateQwdttCommand,
    UpsertQwdttUserCommand,
} from '@libs/contracts/commands';
import { ERRORS } from '@libs/contracts/constants';

import {
    buildClientUri,
    buildSubscriptionDocument,
    effectiveHashes,
    envHashOverride,
    generatePassword,
    hashSource,
    MAX_HASHES,
    normalizeHashes,
    parseHashes,
    withPeerHost,
} from './qwdtt-links';
import { createHashViaRemotePanel } from './qwdtt-remote';
import { ICreatedCall, QwdttVkClient, VkTransportError } from './qwdtt-vk';
import { QwdttRepository, QwdttUserWithProfile } from './qwdtt.repository';

const DEAD_THRESHOLD = 2;
export const QWDTT_INTEGRATION_KEY = 'qwdtt';

@Injectable()
export class QwdttService {
    private readonly logger = new Logger(QwdttService.name);
    private readonly vk = new QwdttVkClient();
    private readonly deadStreak = new Map<string, number>();
    private hashChain: Promise<unknown> = Promise.resolve();

    constructor(
        private readonly repository: QwdttRepository,
        private readonly axios: AxiosService,
    ) {}

    public async getView(): Promise<TResult<GetQwdttCommand.Response['response']>> {
        try {
            return ok(await this.buildView());
        } catch (error) {
            this.logger.error(error);
            return fail(ERRORS.GET_QWDTT_ERROR);
        }
    }

    public async updateSettings(
        body: UpdateQwdttCommand.Request,
    ): Promise<TResult<GetQwdttCommand.Response['response']>> {
        try {
            const data: Partial<QwdttSettings> = {};
            if (body.enabled !== undefined) data.enabled = body.enabled;
            if (body.remark !== undefined) data.remark = body.remark.trim();
            if (body.listenAddr !== undefined) data.listenAddr = body.listenAddr.trim();
            if (body.wgPort !== undefined) data.wgPort = body.wgPort;
            if (body.dns !== undefined) data.dns = body.dns.trim();
            if (body.listenRaw !== undefined) data.listenRaw = body.listenRaw.trim();
            if (body.listenDirect !== undefined) data.listenDirect = body.listenDirect.trim();
            if (body.subHost !== undefined) data.subHost = body.subHost.trim();
            if (body.vkHashes !== undefined) data.vkHashes = normalizeHashes(body.vkHashes);
            if (body.clientPort !== undefined) data.clientPort = body.clientPort;
            if (body.workers !== undefined) data.workers = body.workers;
            if (body.autoVkHash !== undefined) data.autoVkHash = body.autoVkHash;
            if (body.nodeUuids !== undefined) data.nodeUuids = body.nodeUuids;
            if (body.remoteWdttUrl !== undefined) data.remoteWdttUrl = body.remoteWdttUrl.trim();
            if (body.remoteWdttCookie !== undefined) {
                data.remoteWdttCookie = body.remoteWdttCookie.trim();
            }
            if (body.remoteWdttCsrfToken !== undefined) {
                data.remoteWdttCsrfToken = body.remoteWdttCsrfToken.trim();
            }
            const saved = await this.repository.updateSettings(data);
            if (saved.enabled && saved.autoVkHash && !envHashOverride()) {
                await this.ensureHashesNow().catch((error) =>
                    this.logger.warn(`qwdtt: creating a VK hash: ${error}`),
                );
            }
            if (body.syncNodes !== false) {
                await this.syncAssignedNodes();
            }
            return ok(await this.buildView());
        } catch (error) {
            this.logger.error(error);
            return fail(ERRORS.UPDATE_QWDTT_ERROR);
        }
    }

    public async saveCookies(raw: string): Promise<TResult<GetQwdttCommand.Response['response']>> {
        try {
            const canon = this.vk.parseCookies(raw);
            await this.repository.updateSettings({ vkCookies: canon });
            const settings = await this.repository.getOrCreateSettings();
            if (settings.enabled && settings.autoVkHash) {
                await this.ensureHashesNow().catch((error) =>
                    this.logger.warn(`qwdtt: creating a VK hash: ${error}`),
                );
            }
            await this.syncAssignedNodes();
            return ok(await this.buildView());
        } catch (error) {
            this.logger.warn(error);
            return fail(ERRORS.QWDTT_COOKIE_ERROR);
        }
    }

    public async clearCookies(): Promise<TResult<GetQwdttCommand.Response['response']>> {
        try {
            await this.repository.updateSettings({ vkCookies: '' });
            return ok(await this.buildView());
        } catch (error) {
            this.logger.error(error);
            return fail(ERRORS.UPDATE_QWDTT_ERROR);
        }
    }

    public async checkCookies(): Promise<TResult<CheckQwdttCookiesCommand.Response['response']>> {
        try {
            const settings = await this.repository.getOrCreateSettings();
            await this.vk.checkCookies(settings.vkCookies);
            return ok({ ok: true });
        } catch (error) {
            return ok({
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    public async generateHash(
        replaceOldest = false,
    ): Promise<TResult<GenerateQwdttHashCommand.Response['response']>> {
        try {
            const call = await this.withHashLock(() => this.generateLocked(replaceOldest, ''));
            await this.syncAssignedNodes();
            const view = await this.buildView();
            return ok({ ...view, generatedHash: call.hash });
        } catch (error) {
            this.logger.warn(error);
            return fail(ERRORS.QWDTT_HASH_ERROR);
        }
    }

    public async checkHashes() {
        const settings = await this.repository.getOrCreateSettings();
        const ours = new Set(this.loadCalls(settings).map((call) => call.hash));
        const hashes = parseHashes(effectiveHashes(settings.vkHashes));
        const out = [];
        for (const hash of hashes) {
            try {
                const alive = await this.vk.callAlive(hash);
                out.push({ hash, alive, generated: ours.has(hash) });
            } catch (error) {
                out.push({
                    hash,
                    alive: null,
                    generated: ours.has(hash),
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        return ok(out);
    }

    public async listUsers(): Promise<TResult<GetQwdttUsersCommand.Response['response']>> {
        try {
            const settings = await this.repository.getOrCreateSettings();
            const rows = await this.repository.listUsers();
            const host = await this.resolveHostFromNodes(settings);
            return ok(rows.map((row) => this.toUserAccess(settings, row, host)));
        } catch (error) {
            this.logger.error(error);
            return fail(ERRORS.GET_QWDTT_ERROR);
        }
    }

    public async upsertUser(
        body: UpsertQwdttUserCommand.Request,
    ): Promise<TResult<UpsertQwdttUserCommand.Response['response']>> {
        try {
            const user = await this.repository.findUserByUsernameOrId({
                userId: body.userId,
                username: body.username,
            });
            if (!user) {
                return fail(ERRORS.QWDTT_USER_NOT_FOUND);
            }
            const existing = await this.repository.findUser(user.id);
            const password =
                body.rotatePassword || !existing ? generatePassword(16) : existing.password;
            const row = await this.repository.upsertUser(user.id, {
                password,
                enabled: body.enabled ?? existing?.enabled ?? true,
            });
            await this.syncAssignedNodes();
            const settings = await this.repository.getOrCreateSettings();
            return ok(this.toUserAccess(settings, row, await this.resolveHostFromNodes(settings)));
        } catch (error) {
            this.logger.error(error);
            return fail(ERRORS.UPDATE_QWDTT_ERROR);
        }
    }

    public async deleteUser(userId: number): Promise<TResult<{ ok: boolean }>> {
        try {
            await this.repository.deleteUser(BigInt(userId));
            await this.syncAssignedNodes();
            return ok({ ok: true });
        } catch (error) {
            this.logger.error(error);
            return fail(ERRORS.UPDATE_QWDTT_ERROR);
        }
    }

    public async getUserLink(
        userId: number,
    ): Promise<TResult<GetQwdttUserLinkCommand.Response['response']>> {
        try {
            const settings = await this.repository.getOrCreateSettings();
            const row = await this.repository.findUser(BigInt(userId));
            if (!row) {
                return fail(ERRORS.QWDTT_USER_NOT_FOUND);
            }
            const link = await this.userLink(settings, row);
            const subscription = link
                ? JSON.stringify(
                      buildSubscriptionDocument({
                          remark: settings.remark || row.user.username,
                          peer: this.resolveHost(settings),
                          hashes: effectiveHashes(settings.vkHashes),
                          workers: settings.workers,
                          clientPort: settings.clientPort,
                          password: row.password,
                      }),
                      null,
                      2,
                  )
                : '';
            return ok({ link, subscription });
        } catch (error) {
            this.logger.error(error);
            return fail(ERRORS.GET_QWDTT_ERROR);
        }
    }

    public async getPublicDocument(shortUuid: string): Promise<string | null> {
        const settings = await this.repository.getOrCreateSettings();
        if (!settings.enabled) {
            return null;
        }
        const rows = await this.repository.listUsers();
        const row = rows.find(
            (item) => item.user.shortUuid === shortUuid && this.userIsActive(item),
        );
        if (!row) {
            return null;
        }
        const peer = await this.resolveHostFromNodes(settings);
        if (!peer || !row.password) {
            return null;
        }
        return JSON.stringify(
            buildSubscriptionDocument({
                remark: settings.remark || row.user.username,
                peer,
                hashes: effectiveHashes(settings.vkHashes),
                workers: settings.workers,
                clientPort: settings.clientPort,
                password: row.password,
            }),
            null,
            2,
        );
    }

    public async getPublicLinkForUser(userId: bigint): Promise<string> {
        const settings = await this.repository.getOrCreateSettings();
        if (!settings.enabled) {
            return '';
        }
        const row = await this.repository.findUser(userId);
        if (!row || !this.userIsActive(row)) {
            return '';
        }
        return await this.userLink(settings, row);
    }

    public async getNodePayload(nodeUuid: string): Promise<INodeQwdttSyncRequest | null> {
        const settings = await this.repository.getOrCreateSettings();
        if (!settings.nodeUuids.includes(nodeUuid)) {
            return null;
        }
        return this.buildPayload(settings);
    }

    public async restartAndStatus() {
        const view = await this.buildView();
        const nodes = await this.syncAssignedNodes();
        return ok({ ...view, nodes });
    }

    public async nodeStatuses() {
        return ok(await this.collectNodeStatuses());
    }

    public async getAdminSubscriptionPreview(): Promise<TResult<{ document: string }>> {
        try {
            const settings = await this.repository.getOrCreateSettings();
            const host = await this.resolveHostFromNodes(settings);
            const rows = await this.repository.listUsers();
            const now = new Date();
            const y = now.getUTCFullYear();
            const m = String(now.getUTCMonth() + 1).padStart(2, '0');
            const d = String(now.getUTCDate()).padStart(2, '0');
            const hashes = effectiveHashes(settings.vkHashes);
            const document = JSON.stringify(
                {
                    subscriptionName: settings.remark || 'qWDTT',
                    description: host ? `qWDTT tunnel via ${host}` : '',
                    version: 1,
                    updatedAt: `${y}-${m}-${d}`,
                    profiles: rows
                        .filter((row) => this.userIsActive(row))
                        .map((row) => ({
                            name: settings.remark || row.user.username,
                            peer: host,
                            hashes,
                            workers: settings.workers,
                            port: settings.clientPort,
                            password: row.password,
                        })),
                },
                null,
                2,
            );
            return ok({ document });
        } catch (error) {
            this.logger.error(error);
            return fail(ERRORS.GET_QWDTT_ERROR);
        }
    }

    public async maintainHashes(): Promise<boolean> {
        const settings = await this.repository.getOrCreateSettings();
        if (!settings.enabled || !settings.autoVkHash || envHashOverride()) {
            return false;
        }
        return this.withHashLock(async () => {
            const list = parseHashes(settings.vkHashes);
            if (list.length === 0) {
                if (!(await this.canGenerate(settings))) {
                    return false;
                }
                await this.generateLocked(false, '');
                return true;
            }
            let changed = false;
            for (const hash of list) {
                let alive: boolean;
                try {
                    alive = await this.vk.callAlive(hash);
                } catch (error) {
                    if (!(error instanceof VkTransportError)) {
                        this.logger.warn(`qwdtt: hash check ${hash}: ${error}`);
                    }
                    continue;
                }
                if (alive) {
                    this.deadStreak.delete(hash);
                    continue;
                }
                const n = (this.deadStreak.get(hash) ?? 0) + 1;
                this.deadStreak.set(hash, n);
                if (n < DEAD_THRESHOLD) {
                    continue;
                }
                this.logger.log(`qwdtt: VK call for hash ${hash} has ended, creating a new one`);
                await this.generateLocked(false, hash);
                this.deadStreak.delete(hash);
                changed = true;
            }
            return changed;
        });
    }

    public async ensureHashesNow(): Promise<boolean> {
        const settings = await this.repository.getOrCreateSettings();
        if (
            !settings.autoVkHash ||
            envHashOverride() ||
            parseHashes(settings.vkHashes).length > 0
        ) {
            return false;
        }
        if (!(await this.canGenerate(settings))) {
            return false;
        }
        await this.withHashLock(() => this.generateLocked(false, ''));
        return true;
    }

    public async syncAssignedNodes() {
        const settings = await this.repository.getOrCreateSettings();
        const payload = await this.buildPayload(settings);
        const nodes = await this.repository.findNodesByUuids(settings.nodeUuids);
        const results = [];
        for (const node of nodes) {
            const opts = this.opts(node);
            if (node.isDisabled) {
                results.push({
                    nodeUuid: node.uuid,
                    nodeName: node.name,
                    error: 'node is disabled',
                    unreachable: true,
                });
                continue;
            }
            const result = await this.axios.syncQwdtt(payload, opts);
            if (!result.isOk) {
                results.push({
                    nodeUuid: node.uuid,
                    nodeName: node.name,
                    error: result.message ?? 'sync failed',
                    unreachable: true,
                });
                continue;
            }
            results.push({
                nodeUuid: node.uuid,
                nodeName: node.name,
                running: result.response.running,
                pid: result.response.pid,
                error: result.response.error ?? undefined,
            });
        }
        return results;
    }

    public async collectTraffic(): Promise<void> {
        const settings = await this.repository.getOrCreateSettings();
        if (!settings.enabled || settings.nodeUuids.length === 0) {
            return;
        }
        const users = await this.repository.listUsers();
        const byPassword = new Map(users.map((row) => [row.password, row]));
        const nodes = await this.repository.findNodesByUuids(settings.nodeUuids);
        for (const node of nodes) {
            if (node.isDisabled) {
                continue;
            }
            const result = await this.axios.getQwdttTraffic(this.opts(node));
            if (!result.isOk) {
                this.logger.warn(`qwdtt: traffic from ${node.name}: ${result.message ?? 'failed'}`);
                continue;
            }
            for (const entry of result.response.users) {
                const row = byPassword.get(entry.password);
                if (!row) {
                    continue;
                }
                const up = BigInt(entry.upBytes);
                const down = BigInt(entry.downBytes);
                const prevUp = row.reportedUpBytes;
                const prevDown = row.reportedDownBytes;
                const deltaUp = up >= prevUp ? up - prevUp : 0n;
                const deltaDown = down >= prevDown ? down - prevDown : 0n;
                const delta = deltaUp + deltaDown;
                if (delta > 0n) {
                    await this.repository.addUserTraffic(row.userId, delta, node.uuid);
                    await this.repository.addNodeUserUsage(node.id, row.userId, delta);
                }
                if (up !== prevUp || down !== prevDown) {
                    await this.repository.updateReportedTraffic(row.userId, up, down);
                    row.reportedUpBytes = up;
                    row.reportedDownBytes = down;
                }
            }
        }
    }

    public async collectNodeStatuses() {
        const settings = await this.repository.getOrCreateSettings();
        const nodes = await this.repository.findNodesByUuids(settings.nodeUuids);
        const out = [];
        for (const node of nodes) {
            const result = await this.axios.getQwdttStatus(this.opts(node));
            if (!result.isOk) {
                out.push({
                    nodeUuid: node.uuid,
                    nodeName: node.name,
                    unreachable: true,
                    error: result.message ?? 'unreachable',
                });
                continue;
            }
            out.push({
                nodeUuid: node.uuid,
                nodeName: node.name,
                ...result.response,
            });
        }
        return out;
    }

    private async buildPayload(settings: QwdttSettings): Promise<INodeQwdttSyncRequest> {
        const users = await this.repository.listUsers();
        return {
            enabled: settings.enabled,
            listenAddr: settings.listenAddr,
            wgPort: settings.wgPort,
            dns: settings.dns,
            listenRaw: settings.listenRaw,
            listenDirect: settings.listenDirect,
            mainPassword: settings.mainPassword,
            users: users.map((row) => ({
                username: row.user.username,
                password: row.password,
                label: row.user.username,
                maxDevices: row.user.hwidDeviceLimit ?? 0,
                expiresAt: row.user.expireAt ? Math.floor(row.user.expireAt.getTime() / 1000) : 0,
                isDeactivated: !row.enabled || row.user.status !== 'ACTIVE',
            })),
        };
    }

    private async buildView(): Promise<GetQwdttCommand.Response['response']> {
        const settings = await this.repository.getOrCreateSettings();
        const hashes = parseHashes(effectiveHashes(settings.vkHashes));
        const source = hashSource(settings.vkHashes);
        return {
            config: {
                enabled: settings.enabled,
                remark: settings.remark,
                listenAddr: settings.listenAddr,
                wgPort: settings.wgPort,
                dns: settings.dns,
                listenRaw: settings.listenRaw,
                listenDirect: settings.listenDirect,
                subHost: settings.subHost,
                vkHashes: settings.vkHashes,
                clientPort: settings.clientPort,
                workers: settings.workers,
                autoVkHash: settings.autoVkHash,
                nodeUuids: settings.nodeUuids,
                remoteWdttUrl: settings.remoteWdttUrl,
                hasRemoteWdttAuth: Boolean(settings.remoteWdttCookie),
            },
            status: {
                hashEnv: Boolean(envHashOverride()),
                hasCookies: Boolean(settings.vkCookies),
                hashSource: source === 'manual' && hashes.length ? 'panel' : source,
                resolvedHost: await this.resolveHostFromNodes(settings),
                hashes,
                egress: 'sidecar-nat',
            },
            linkPreview: this.previewLink(settings, await this.resolveHostFromNodes(settings)),
        };
    }

    private previewLink(settings: QwdttSettings, peer?: string): string {
        return buildClientUri({
            remark: settings.remark,
            peer: peer ?? this.resolveHost(settings),
            hashes: effectiveHashes(settings.vkHashes),
            workers: settings.workers,
            clientPort: settings.clientPort,
            password: '••••',
        });
    }

    private async userLink(
        settings: QwdttSettings,
        row: QwdttUserWithProfile,
        peer?: string,
    ): Promise<string> {
        if (!settings.enabled || !this.userIsActive(row)) {
            return '';
        }
        return buildClientUri({
            remark: settings.remark || row.user.username,
            peer: peer ?? (await this.resolveHostFromNodes(settings)),
            hashes: effectiveHashes(settings.vkHashes),
            workers: settings.workers,
            clientPort: settings.clientPort,
            password: row.password,
        });
    }

    private userIsActive(row: QwdttUserWithProfile): boolean {
        return row.enabled && row.user.status === 'ACTIVE';
    }

    private toUserAccess(settings: QwdttSettings, row: QwdttUserWithProfile, host: string) {
        return {
            userId: Number(row.userId),
            username: row.user.username,
            shortUuid: row.user.shortUuid,
            enabled: row.enabled,
            status: row.user.status,
            link:
                settings.enabled && this.userIsActive(row)
                    ? buildClientUri({
                          remark: settings.remark || row.user.username,
                          peer: host,
                          hashes: effectiveHashes(settings.vkHashes),
                          workers: settings.workers,
                          clientPort: settings.clientPort,
                          password: row.password,
                      })
                    : '',
            reportedUpBytes: Number(row.reportedUpBytes),
            reportedDownBytes: Number(row.reportedDownBytes),
        };
    }

    private resolveHost(settings: QwdttSettings): string {
        if (settings.subHost.trim()) {
            return withPeerHost(settings.subHost, settings.listenAddr);
        }
        return '';
    }

    private async resolveHostFromNodes(settings: QwdttSettings): Promise<string> {
        const fromSettings = this.resolveHost(settings);
        if (fromSettings) {
            return fromSettings;
        }
        const nodes = await this.repository.findNodesByUuids(settings.nodeUuids);
        const live = nodes.find((node) => !node.isDisabled);
        return live ? withPeerHost(live.address, settings.listenAddr) : '';
    }

    private opts(node: {
        address: string;
        port: number | null;
        proxyUrl: string | null;
    }): INodeConnectionOpts {
        return { address: node.address, port: node.port, proxyUrl: node.proxyUrl };
    }

    private loadCalls(settings: QwdttSettings): ICreatedCall[] {
        if (!settings.vkCalls.trim()) {
            return [];
        }
        try {
            const parsed = JSON.parse(settings.vkCalls) as ICreatedCall[];
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    private async canGenerate(settings: QwdttSettings): Promise<boolean> {
        return (
            Boolean(settings.vkCookies) ||
            Boolean(settings.remoteWdttUrl && settings.remoteWdttCookie)
        );
    }

    private async generateLocked(
        replaceOldest: boolean,
        replaceHash: string,
    ): Promise<ICreatedCall> {
        if (envHashOverride()) {
            throw new Error(
                `${'QWDTT_VK_HASH'} is set; the hash list is managed through the environment`,
            );
        }
        const settings = await this.repository.getOrCreateSettings();
        let call: ICreatedCall;
        try {
            if (settings.vkCookies) {
                call = await this.vk.createCall(settings.vkCookies);
            } else {
                const remote = await createHashViaRemotePanel({
                    baseUrl: settings.remoteWdttUrl,
                    cookie: settings.remoteWdttCookie,
                    csrfToken: settings.remoteWdttCsrfToken,
                });
                call = {
                    callId: '',
                    joinLink: remote.joinLink,
                    hash: remote.hash,
                    startedAt: Math.floor(Date.now() / 1000),
                };
            }
        } catch (error) {
            if (settings.vkCookies && settings.remoteWdttUrl && settings.remoteWdttCookie) {
                this.logger.warn(`qwdtt: VK cookies failed, trying remote panel: ${error}`);
                const remote = await createHashViaRemotePanel({
                    baseUrl: settings.remoteWdttUrl,
                    cookie: settings.remoteWdttCookie,
                    csrfToken: settings.remoteWdttCsrfToken,
                });
                call = {
                    callId: '',
                    joinLink: remote.joinLink,
                    hash: remote.hash,
                    startedAt: Math.floor(Date.now() / 1000),
                };
            } else {
                throw error;
            }
        }

        const list = parseHashes(settings.vkHashes);
        let dropped = '';
        let replaced = '';
        if (replaceHash) {
            const idx = list.indexOf(replaceHash);
            if (idx >= 0) {
                list[idx] = call.hash;
                replaced = replaceHash;
            }
        }
        if (!replaced) {
            if (list.length >= MAX_HASHES) {
                if (!replaceOldest) {
                    if (call.callId && settings.vkCookies) {
                        await this.vk
                            .finishCall(settings.vkCookies, call.callId)
                            .catch(() => undefined);
                    }
                    throw new Error(`already ${MAX_HASHES} hashes; remove one first`);
                }
                dropped = list[0];
                list.splice(0, 1);
            }
            list.push(call.hash);
        }
        let calls = this.loadCalls(settings);
        calls.push(call);
        if (replaced) {
            calls = calls.filter((item) => item.hash !== replaced);
        }
        if (dropped && settings.vkCookies) {
            const gone = calls.find((item) => item.hash === dropped);
            if (gone?.callId) {
                await this.vk.finishCall(settings.vkCookies, gone.callId).catch(() => undefined);
            }
            calls = calls.filter((item) => item.hash !== dropped);
        }
        if (calls.length > 32) {
            calls = calls.slice(-32);
        }
        await this.repository.updateSettings({
            vkHashes: list.join(','),
            vkCalls: JSON.stringify(calls),
        });
        return call;
    }

    private async withHashLock<T>(fn: () => Promise<T>): Promise<T> {
        const run = this.hashChain.then(fn, fn);
        this.hashChain = run.then(
            () => undefined,
            () => undefined,
        );
        return run;
    }
}
