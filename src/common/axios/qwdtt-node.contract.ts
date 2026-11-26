/**
 * Typed copy of the qWDTT routes added to node-X/libs/contract
 * (@remnawave/node-contract 3.4.6-x.1). Backend still depends on the
 * published 3.4.5 package; keep this file in sync with node-X.
 */

export const NODE_QWDTT_ROUTES = {
    SYNC: '/node/qwdtt/sync',
    STATUS: '/node/qwdtt/status',
    TRAFFIC: '/node/qwdtt/traffic',
} as const;

export interface INodeQwdttPasswordEntry {
    username: string;
    password: string;
    label?: string;
    maxDevices?: number;
    expiresAt?: number;
    isDeactivated?: boolean;
}

export interface INodeQwdttSyncRequest {
    enabled: boolean;
    listenAddr: string;
    wgPort: number;
    dns: string;
    listenRaw?: string;
    listenDirect?: string;
    mainPassword: string;
    configDir?: string;
    users: INodeQwdttPasswordEntry[];
}

export interface INodeQwdttSyncResponse {
    error: string | null;
    running: boolean;
    pid: number;
}

export interface INodeQwdttStatusResponse {
    supported: boolean;
    enabled: boolean;
    running: boolean;
    pid: number;
    uptime: number;
    binary: string;
    binaryFound: boolean;
    egress: 'sidecar-nat';
    error?: string;
    lastExit?: string;
    logs: string[];
}

export interface INodeQwdttTrafficEntry {
    password: string;
    label?: string;
    upBytes: number;
    downBytes: number;
    deviceCount: number;
    isDeactivated: boolean;
}

export interface INodeQwdttTrafficResponse {
    users: INodeQwdttTrafficEntry[];
}
