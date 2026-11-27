/**
 * Draft of the AWG node contract, mirrored from qWDTT's typed copy of
 * node-X/libs/contract. Keep this file in sync with node-X.
 *
 * AWG is not an Xray inbound. StartXray internals.integrations.awg uses
 * INodeAwgSyncRequest. POST /node/awg/sync and GET /node/awg/status are
 * the same shapes. The sidecar itself is not implemented in this phase.
 *
 * The node receives the server private key and peer public keys, plus
 * PSK and the peer IPv4 /32. Client private keys must never appear here
 * or in host options.
 *
 * Combined Remnawave X work is AGPL-3.0-only. Field names follow
 * samur005/3s-ui wgserver.Config and Obfuscation (GPL-3.0).
 */

export const NODE_AWG_ROUTES = {
    SYNC: '/node/awg/sync',
    STATUS: '/node/awg/status',
} as const;

export const AWG_INTEGRATION_KEY = 'awg' as const;

export interface INodeAwgObfuscation {
    jc: number;
    jmin: number;
    jmax: number;
    s1: number;
    s2: number;
    s3?: number;
    s4?: number;
    h1: string;
    h2: string;
    h3: string;
    h4: string;
    i1?: string;
    i2?: string;
    i3?: string;
    i4?: string;
    i5?: string;
    headerProtectionKey?: string;
    contentPaddingAddition?: string;
    rekeyAfterTime?: string;
    rekeyTimeout?: string;
    rejectAfterTime?: string;
    keepaliveTimeout?: string;
    maxHandshakeAttempts?: string;
    randomTrailers?: boolean;
    disableCookies?: boolean;
}

export interface INodeAwgInstance {
    listenPort: number;
    listen?: string;
    // Server private key only. Never a client private key.
    privateKey: string;
    publicKey?: string;
    subnet: string;
    mtu: number;
    dns: string;
    keepalive: number;
    allowedIps: string;
    endpoint?: string;
    version: string;
    obfuscation: INodeAwgObfuscation;
}

export interface INodeAwgPeerEntry {
    publicKey: string;
    presharedKey?: string;
    // IPv4 tunnel address; the node treats it as /32.
    address: string;
    enabled?: boolean;
}

export interface INodeAwgSyncRequest {
    enabled: boolean;
    instance: INodeAwgInstance | null;
    peers: INodeAwgPeerEntry[];
}

export interface INodeAwgSyncResponse {
    error: string | null;
    running: boolean;
    iface: string;
}

export interface INodeAwgStatusResponse {
    supported: boolean;
    enabled: boolean;
    running: boolean;
    iface: string;
    peers: number;
    online: number;
    version?: string;
    egress: 'sidecar-nat';
    error?: string;
    lastExit?: string;
}
