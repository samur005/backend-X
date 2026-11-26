import { z } from 'zod';

export const QwdttSettingsSchema = z.object({
    enabled: z.boolean(),
    remark: z.string(),
    listenAddr: z.string(),
    wgPort: z.number().int(),
    dns: z.string(),
    listenRaw: z.string(),
    listenDirect: z.string(),
    subHost: z.string(),
    vkHashes: z.string(),
    clientPort: z.number().int(),
    workers: z.number().int(),
    autoVkHash: z.boolean(),
    nodeUuids: z.array(z.uuid()),
    remoteWdttUrl: z.string(),
    hasRemoteWdttAuth: z.boolean(),
});

export const QwdttStatusSchema = z.object({
    hashEnv: z.boolean(),
    hasCookies: z.boolean(),
    hashSource: z.enum(['env', 'panel', 'manual', '']),
    resolvedHost: z.string(),
    hashes: z.array(z.string()),
    egress: z.literal('sidecar-nat'),
});

export const QwdttHashStatusSchema = z.object({
    hash: z.string(),
    alive: z.nullable(z.boolean()),
    generated: z.boolean(),
    error: z.string().optional(),
});

export const QwdttUserAccessSchema = z.object({
    userId: z.number().int(),
    username: z.string(),
    shortUuid: z.string(),
    enabled: z.boolean(),
    status: z.string(),
    link: z.string(),
    reportedUpBytes: z.number().int(),
    reportedDownBytes: z.number().int(),
});

export const QwdttNodeStatusSchema = z.object({
    nodeUuid: z.uuid(),
    nodeName: z.string(),
    supported: z.boolean().optional(),
    enabled: z.boolean().optional(),
    running: z.boolean().optional(),
    pid: z.number().int().optional(),
    uptime: z.number().int().optional(),
    binaryFound: z.boolean().optional(),
    egress: z.string().optional(),
    error: z.string().optional(),
    unreachable: z.boolean().optional(),
});

export const QwdttViewSchema = z.object({
    config: QwdttSettingsSchema,
    status: QwdttStatusSchema,
    linkPreview: z.string(),
});
