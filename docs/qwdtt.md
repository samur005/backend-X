# qWDTT in Remnawave X

This document is the contract for the qWDTT integration in the samur005 Remnawave X forks
(`backend-X`, `frontend-X`, `node-X`). Combined work stays under **AGPL-3.0-only**, same
as Remnawave X. Logic is ported from [samur005/3s-ui](https://github.com/samur005/3s-ui)
(GPL-3.0), not from LucX (`internal/lucx/*`, PolyForm Noncommercial — do not copy).

The sidecar binary is [SpaceNeuroX/proxy-turn-vk-android](https://github.com/SpaceNeuroX/proxy-turn-vk-android)
(GPL-3.0), built by `node-X/scripts/build-qwdtt.sh` (same pin and subnet patch as 3s-ui).

Images (never `remnawave/*`):

- `ghcr.io/samur005/backend-x:<upstream>-x.<n>` (example `3.4.11-x.2`)
- `ghcr.io/samur005/node-x:<upstream>-x.<n>` (example `3.4.6-x.1`)
- Frontend is not a separate image: a zip built from `frontend-X` is baked into
  the backend image through `FRONTEND_URL`.
- Pinned frontend zip (tag `3.4.11-x.2` on `frontend-X`, not `main`):
  `https://github.com/samur005/frontend-X/releases/download/3.4.11-x.2/remnawave-frontend.zip`
- Moving tags for the installer: `ghcr.io/samur005/backend-x:3`, `ghcr.io/samur005/backend-x:latest`,
  `ghcr.io/samur005/node-x:latest`.

## Architecture

```
  Client (qwdtt:// or JSON subscription)
       |  DTLS / optional raw / direct
       v
  qWDTT sidecar on the node  -->  wdtt0 (10.68.0.0/16) / wdttraw0 (10.70.0.0/16)
       |                              |
       |                         sidecar MASQUERADE
       |                              v
       |                         node's default WAN
       |
  Remnawave X Node agent  -- supervises sidecar, writes passwords.json, SIGHUP
       ^
       |  StartXray internals.integrations.qwdtt
       |  and POST /node/qwdtt/sync  (no Xray restart)
       |
  Remnawave X Backend  -- settings, VK hashes, users, links, traffic deltas
```

qWDTT is a **separate process**, not an Xray inbound. Existing Xray/VLESS/SS/Trojan
paths are untouched.

## Traffic routing (the decision)

3s-ui optionally steers `wdtt0`/`wdttraw0` into a **sing-box TUN** inbound
(`qwdtt0`, policy table 1977) so panel routing rules and outbounds apply, and
it strips the sidecar's own MASQUERADE so sing-box sees client IPs.

**Remnawave X has no sing-box.** Xray can do TUN, but injecting an auto-routed TUN
into a Remnawave X config profile would steal the host default route (`auto_route`)
or require a fragile, profile-specific inbound the operator did not declare.
That path is **not implemented**.

**v1 egress is the sidecar's native NAT:** the server already installs
iptables/nft `MASQUERADE` from the client subnets out the node's default WAN
interface and enables `ip_forward`. Client traffic does **not** enter Xray.
The node container needs `NET_ADMIN` and `/dev/net/tun` (the official
`docker-compose-prod.yml` already has `NET_ADMIN` and `network_mode: host`).

This is the same behaviour 3s-ui uses when `RouteThroughCore` is off.

## VK Hash sources (priority)

1. **Pinned env** `QWDTT_VK_HASH` (comma/space/semicolon-separated, or join
   URLs). While set, stored hashes are ignored and nothing is generated or
   replaced automatically. Same idea as 3s-ui `S3UI_VK_HASH`.
2. **VK cookies + VK API**, ported from 3s-ui `qwdtt/vk.go`:
   `remixsid` cookies → `login.vk.ru/?act=web_token` → `calls.start` /
   `calls.getCallPreview` (anonymous token) / `calls.forceFinish`.
   Auto-maintain replaces a hash only after two consecutive "call ended"
   answers.
3. **Optional remote WDTT panel** (`ildarmaga/wdtt` style)
   `POST {base}/panel/api/vk/call/create`. That API is session+CSRF protected;
   the operator must store a Cookie header and optional CSRF token. Used only
   when auto-hash is on, env is unset, and cookies are missing or the VK API
   call failed. This fallback is **not** in current 3s-ui; it is implemented
   here because the original brief asked for it.

Max 4 hashes in a share link (`MaxHashes = 4`), same as 3s-ui.

## Users, passwords, devices, expiry, quota

Unlike current 3s-ui (one shared password in every granted client's link),
Remnawave X issues a **per-user password**. That maps onto the sidecar's
`passwords.json` `passwords` map (`PasswordEntry`: `label`, `max_devices`,
`expires_at`, `is_deactivated`, traffic counters). The sidecar reloads the
file on **SIGHUP**. Device WireGuard keys and cumulative byte counters already
in the file are preserved across writes.

- Label = Remnawave X username
- `max_devices` = `hwidDeviceLimit` (0 = sidecar default)
- `expires_at` = `Users.expireAt` (unix seconds; 0 only if absent)
- `is_deactivated` = user status is not `ACTIVE`, or qWDTT access is disabled
- Traffic quota is **not** a sidecar field. When Remnawave X marks the user
  `LIMITED` / `EXPIRED` / `DISABLED`, the password is deactivated (or omitted).
  Sidecar-reported bytes are applied as **deltas** to `UserTraffic` and, when
  a node id is known, `NodesUserUsageHistory`. Counters in `passwords.json`
  are treated as cumulative since the password was created.

A random **main/owner password** is stored only on the backend and passed as
`-password`. It is never placed in a user share link.

## Internal squads

qWDTT is not an Xray inbound, so it is not selected from the inbound checklist.
An internal squad has an `includeQwdtt` flag. Members of a squad with that flag
get qWDTT credentials and the `qwdtt://` line in the subscription. Access created
only through a squad is revoked when the user leaves every such squad. Access
granted manually on the qWDTT page is kept even if the user leaves the squad.

## Admin cookies

The admin GET view returns the stored VK cookies so the settings form can keep
the value after Save and when the page is opened again. Do not log or print those
values.

## Links and subscription

Format is taken from 3s-ui, not invented:

- Share link (one line, never a trailing `wdtt://`):
  `qwdtt://config?name=...&peer=host%3Aport&hashes=h1%2Ch2&workers=16&port=9000&pass=...`
- JSON document the Android client imports:
  `{ subscriptionName, description, version: 1, updatedAt: "YYYY-MM-DD", profiles: [{ name, peer, hashes, workers, port, password }] }`

The regular XRAY_BASE64 subscription gets the `qwdtt://` line appended (then
re-encoded) when the user has access and qWDTT is enabled with a resolvable
peer. Clash/sing-box/Xray JSON templates are not modified — those clients do
not speak qWDTT. A dedicated public document is served at
`/api/sub/:shortUuid/qwdtt`.

`peer` comes from `subHost` if set, otherwise the first assigned node whose
address is a public hostname or public IP, plus `:<dtlsPort>`. A node
management address on a private network (for example `172.30.0.1` on the
installer Docker bridge) is skipped: that address is not reachable by a
client, so the operator must set **Subscription host** (`subHost`) to the
public hostname or IP of the node (e.g. `node.example.com`).

`port` in the share link is `clientPort` (default 9000). That is a
client-local setting, not a listen port on the server.

## Firewall

The sidecar listens on `listenAddr` (default `0.0.0.0:56000` TCP and UDP,
this is the `peer` port), `wgPort` (default `56001/udp`) and `listenRaw`
(default `0.0.0.0:56003/udp`). The Remnawave X installer opens those default
ports in ufw. If UFW (or a provider firewall) leaves `56000` closed, the
client cannot reach the peer even when the sidecar is running. Do not open
`clientPort` (9000) on the server. After changing listen ports in the
panel, open the new ports and close the old ones.

## Backend ↔ Node contract

Existing `StartXrayCommand.internals.integrations` is a `Record<string, unknown>`.
The backend puts the sidecar payload under the key `qwdtt` (alongside any
operator Node Integrations). The node integration module
`src/integration-modules/qwdtt/qwdtt.integration.ts` reads that key and
reconciles the process. This does not require a new StartXray field.

For password/hash updates **without restarting Xray**, node-X adds:

- `POST /node/qwdtt/sync`
- `GET /node/qwdtt/status`
- `GET /node/qwdtt/traffic`

Those commands live in `node-X/libs/contract` (`@remnawave/node-contract`
3.4.6-x.1). Backend-X carries a typed copy under
`src/modules/qwdtt/node-qwdtt.contract.ts` because the published npm package
is still 3.4.5. Keep the two in sync.

## Traffic accounting limitations

The sidecar writes per-password `up_bytes` / `down_bytes` into `passwords.json`
(and a coarse `server.log` JSON with node-wide totals). There is no stable
admin HTTP API in the pinned sidecar tag that we use for this; the node reads
the file.

If the file is lost or a password is rotated, cumulative counters reset and
the panel will not invent a negative delta. qWDTT usage is added to the
user's existing Remnawave X traffic counters; it is **not** a second isolated
quota.

## What is out of scope in this change

- Publishing images to GHCR from this document
- Routing qWDTT traffic through Xray
