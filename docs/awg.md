# AWG in Remnawave X (Phase 1)

This document is the contract for the AmneziaWG integration in the samur005
Remnawave X forks (`backend-X`, `node-X`). Combined work stays under
**AGPL-3.0-only**, same as Remnawave X. Logic is ported from
[samur005/3s-ui](https://github.com/samur005/3s-ui) (`wgserver`, GPL-3.0),
not from LucX (`internal/lucx/*`, PolyForm Noncommercial — do not copy).

This phase adds only the data model and a draft of the node contract. The
sidecar, panel module, frontend, subscription page and installer come later.
The `amneziawg-go` engine is not vendored here; its license should be checked
again before a later phase mentions or bundles it.

## Data model

Additive Prisma migrations only (no DROP, no volume wipes):

1. `20261127120000_add_awg` — tables `awg_settings`, `awg_instances`, `awg_peers`
2. `20261127120100_add_awg_to_internal_squads` — `internal_squads.include_awg`
   boolean not null default false
3. `20261127120200_add_awg_hosts` — `hosts.is_awg` boolean not null default false

| Entity                        | Purpose                                                                                                                                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `awg_settings`                | One row, like `qwdtt_settings`: enabled, remark, default version 2.0, DNS, keepalive, AllowedIPs, MTU 0 = auto                                                                                                                              |
| `awg_instances`               | One server per node in v1: listen port (default 51820), subnet (`10.8.N.0/24`, prefix 16–29, first address is the server), keys, version, 3s-ui obfuscation fields                                                                          |
| `awg_peers`                   | Per-user peer on an instance: private/public/preshared keys and IPv4 from the subnet. Detach sets `bound=false` and keeps the row; deleting the user deletes the peer. `granted_manually` keeps a manual grant when the user leaves a squad |
| `hosts.is_awg`                | Subscription face (remark, public endpoint, bound to one node). Not an Xray inbound profile                                                                                                                                                 |
| `internal_squads.include_awg` | Like `include_qwdtt`                                                                                                                                                                                                                        |

Client private keys must not live in host options that the browser gets on
every form save. They stay on `awg_peers` and are used only for `vpn://` and
`.conf` in a later phase. The node sees the server private key and peer
public keys, plus PSK and the address `/32`.

Generate / Validate of junk parameters follow
`3s-ui/wgserver/version.go`, including `S1+56 != S2`. The server supports
versions `1.0`, `1.5`, `2.0`, `2.5`, `3.0` and `3.1`. The default is `2.0`
(per-instance, plus the global default in `awg_settings`). Production should
stay on 2.0 until AntiBS2client confirms 3.0/3.1 fields.

## Node contract (draft)

AWG sits beside qWDTT in `StartXray` `internals.integrations.awg`. Sync
without an Xray restart uses the same payload as `POST /node/awg/sync`.
Status is `GET /node/awg/status`.

Typed copies live in:

- `backend-X/src/common/axios/awg-node.contract.ts`
- `node-X/libs/contract/commands/awg` (`SyncAwgCommand`, `GetAwgStatusCommand`)

The sidecar supervisor and Dockerfile are not in this phase. v1 egress
will be sidecar NAT, not Xray, same decision as qWDTT.
