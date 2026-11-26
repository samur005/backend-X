import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { QwdttSettings, QwdttUsers, Users } from '@prisma/client';

import { Injectable } from '@nestjs/common';

import { generatePassword } from './qwdtt-links';

const SETTINGS_ID = 1;

export type QwdttUserWithProfile = QwdttUsers & {
    user: Users;
};

@Injectable()
export class QwdttRepository {
    constructor(private readonly prisma: TransactionHost<TransactionalAdapterPrisma>) {}

    public async getOrCreateSettings(): Promise<QwdttSettings> {
        const existing = await this.prisma.tx.qwdttSettings.findUnique({
            where: { id: SETTINGS_ID },
        });
        if (existing) {
            if (!existing.mainPassword) {
                return this.prisma.tx.qwdttSettings.update({
                    where: { id: SETTINGS_ID },
                    data: { mainPassword: generatePassword(24) },
                });
            }
            return existing;
        }
        return this.prisma.tx.qwdttSettings.create({
            data: {
                id: SETTINGS_ID,
                mainPassword: generatePassword(24),
            },
        });
    }

    public async updateSettings(data: Partial<QwdttSettings>): Promise<QwdttSettings> {
        await this.getOrCreateSettings();
        return this.prisma.tx.qwdttSettings.update({
            where: { id: SETTINGS_ID },
            data,
        });
    }

    public async listUsers(): Promise<QwdttUserWithProfile[]> {
        return this.prisma.tx.qwdttUsers.findMany({
            include: { user: true },
            orderBy: { userId: 'asc' },
        });
    }

    public async findUser(userId: bigint): Promise<QwdttUserWithProfile | null> {
        return this.prisma.tx.qwdttUsers.findUnique({
            where: { userId },
            include: { user: true },
        });
    }

    public async upsertUser(
        userId: bigint,
        data: { password: string; enabled: boolean; grantedManually?: boolean },
    ) {
        return this.prisma.tx.qwdttUsers.upsert({
            where: { userId },
            create: {
                userId,
                password: data.password,
                enabled: data.enabled,
                grantedManually: data.grantedManually ?? true,
            },
            update: {
                password: data.password,
                enabled: data.enabled,
                ...(data.grantedManually !== undefined
                    ? { grantedManually: data.grantedManually }
                    : {}),
            },
            include: { user: true },
        });
    }

    public async findPanelUserIdByShortUuid(shortUuid: string): Promise<bigint | null> {
        const user = await this.prisma.tx.users.findUnique({
            where: { shortUuid },
            select: { id: true },
        });
        return user?.id ?? null;
    }

    public async listUserIdsInQwdttSquads(): Promise<bigint[]> {
        const rows = await this.prisma.tx.internalSquadMembers.findMany({
            where: {
                internalSquad: {
                    includeQwdtt: true,
                },
            },
            select: { userId: true },
            distinct: ['userId'],
        });
        return rows.map((row) => row.userId);
    }

    public async listAutoGrantedUsers(): Promise<QwdttUserWithProfile[]> {
        return this.prisma.tx.qwdttUsers.findMany({
            where: { grantedManually: false },
            include: { user: true },
        });
    }

    public async deleteUser(userId: bigint): Promise<void> {
        await this.prisma.tx.qwdttUsers.delete({ where: { userId } }).catch(() => undefined);
    }

    public async updateReportedTraffic(
        userId: bigint,
        reportedUpBytes: bigint,
        reportedDownBytes: bigint,
    ): Promise<void> {
        await this.prisma.tx.qwdttUsers.update({
            where: { userId },
            data: { reportedUpBytes, reportedDownBytes },
        });
    }

    public async findUserByUsernameOrId(opts: {
        userId?: number;
        username?: string;
    }): Promise<Users | null> {
        if (opts.userId !== undefined) {
            return this.prisma.tx.users.findUnique({ where: { id: BigInt(opts.userId) } });
        }
        if (opts.username) {
            return this.prisma.tx.users.findUnique({ where: { username: opts.username } });
        }
        return null;
    }

    public async findNodesByUuids(uuids: string[]) {
        if (uuids.length === 0) {
            return [];
        }
        return this.prisma.tx.nodes.findMany({
            where: { uuid: { in: uuids } },
            select: {
                uuid: true,
                name: true,
                address: true,
                port: true,
                proxyUrl: true,
                isDisabled: true,
                id: true,
            },
        });
    }

    public async addUserTraffic(userId: bigint, delta: bigint, nodeUuid?: string | null) {
        if (delta <= 0n) {
            return;
        }
        await this.prisma.tx.userTraffic.upsert({
            where: { id: userId },
            create: {
                id: userId,
                usedTrafficBytes: delta,
                lifetimeUsedTrafficBytes: delta,
                lastConnectedNodeUuid: nodeUuid ?? undefined,
                onlineAt: new Date(),
            },
            update: {
                usedTrafficBytes: { increment: delta },
                lifetimeUsedTrafficBytes: { increment: delta },
                lastConnectedNodeUuid: nodeUuid ?? undefined,
                onlineAt: new Date(),
            },
        });
    }

    public async addNodeUserUsage(nodeId: bigint, userId: bigint, delta: bigint) {
        if (delta <= 0n) {
            return;
        }
        const day = new Date();
        day.setUTCHours(0, 0, 0, 0);
        await this.prisma.tx.nodesUserUsageHistory.upsert({
            where: {
                nodeId_createdAt_userId: {
                    nodeId,
                    createdAt: day,
                    userId,
                },
            },
            create: {
                nodeId,
                userId,
                createdAt: day,
                totalBytes: delta,
            },
            update: {
                totalBytes: { increment: delta },
            },
        });
    }
}
