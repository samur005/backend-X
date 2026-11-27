import { Transactional } from '@nestjs-cls/transactional';

import { Injectable, Logger } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';

import { fail, ok, TResult } from '@common/types';
import { cloneString } from '@common/utils/clone-string.util';
import { nullifyEmpty } from '@common/utils/convert-type';
import { ERRORS } from '@libs/contracts/constants';

import { GetConfigProfileByUuidQuery } from '@modules/config-profiles/queries/get-config-profile-by-uuid';
import { isPrivateOrLocalPeerHost } from '@modules/qwdtt/qwdtt-links';
import { GetSubscriptionTemplateByUuidQuery } from '@modules/subscription-template/queries/get-template-by-uuid';

import {
    CreateHostBodyDto,
    ReorderHostsBodyDto,
    UpdateHostBodyDto,
    UpdateManyHostsBodyDto,
} from './dtos';
import { HostsEntity } from './entities/hosts.entity';
import { HostsRepository } from './repositories/hosts.repository';

type TSidecarHostKind = 'qwdtt' | 'awg' | 'conflict';

function sidecarHostKind(isQwdtt: boolean, isAwg: boolean): TSidecarHostKind | null {
    if (isQwdtt && isAwg) {
        return 'conflict';
    }
    if (isAwg) {
        return 'awg';
    }
    if (isQwdtt) {
        return 'qwdtt';
    }
    return null;
}

function sidecarHostNodeError(kind: TSidecarHostKind) {
    if (kind === 'awg') {
        return ERRORS.AWG_HOST_NODE_REQUIRED;
    }
    if (kind === 'conflict') {
        return ERRORS.HOST_SIDECAR_TYPE_CONFLICT;
    }
    return ERRORS.QWDTT_HOST_NODE_REQUIRED;
}

function sidecarHostPrivateError(kind: TSidecarHostKind) {
    if (kind === 'awg') {
        return ERRORS.AWG_HOST_PRIVATE_PEER;
    }
    if (kind === 'conflict') {
        return ERRORS.HOST_SIDECAR_TYPE_CONFLICT;
    }
    return ERRORS.QWDTT_HOST_PRIVATE_PEER;
}

@Injectable()
export class HostsService {
    private readonly logger = new Logger(HostsService.name);
    constructor(
        private readonly hostsRepository: HostsRepository,
        private readonly queryBus: QueryBus,
    ) {}

    public async createHost(dto: CreateHostBodyDto): Promise<TResult<HostsEntity>> {
        try {
            if (dto.xrayJsonTemplateUuid) {
                const xrayJsonTemplate = await this.queryBus.execute(
                    new GetSubscriptionTemplateByUuidQuery(dto.xrayJsonTemplateUuid),
                );

                if (!xrayJsonTemplate.isOk) {
                    return fail(ERRORS.SUBSCRIPTION_TEMPLATE_NOT_FOUND);
                }

                if (xrayJsonTemplate.response.templateType !== 'XRAY_JSON') {
                    return fail(ERRORS.TEMPLATE_TYPE_NOT_ALLOWED);
                }
            }

            const {
                inbound: inboundObj,
                nodes,
                internalSquads,
                xhttpExtraParams,
                muxParams,
                sockoptParams,
                finalMask,
                ...rest
            } = dto;

            const isQwdtt = Boolean(dto.isQwdtt);
            const isAwg = Boolean(dto.isAwg);
            const sidecarKind = sidecarHostKind(isQwdtt, isAwg);
            let configProfileUuid: string | null = null;
            let configProfileInboundUuid: string | null = null;

            if (sidecarKind === 'conflict') {
                return fail(ERRORS.HOST_SIDECAR_TYPE_CONFLICT);
            }

            if (sidecarKind) {
                if (!nodes || nodes.length !== 1) {
                    return fail(sidecarHostNodeError(sidecarKind));
                }
                const address = dto.address.trim();
                if (
                    (address && isPrivateOrLocalPeerHost(address)) ||
                    (address !== '' && isPrivateOrLocalPeerHost(`${address}:${dto.port}`))
                ) {
                    return fail(sidecarHostPrivateError(sidecarKind));
                }
            } else {
                if (!inboundObj) {
                    return fail(ERRORS.CONFIG_PROFILE_INBOUND_NOT_FOUND_IN_SPECIFIED_PROFILE);
                }
                const configProfile = await this.queryBus.execute(
                    new GetConfigProfileByUuidQuery(inboundObj.configProfileUuid),
                );

                if (!configProfile.isOk) {
                    return fail(ERRORS.CONFIG_PROFILE_NOT_FOUND);
                }

                const configProfileInbound = configProfile.response.inbounds.find(
                    (inbound) => inbound.uuid === inboundObj.configProfileInboundUuid,
                );
                if (!configProfileInbound) {
                    return fail(ERRORS.CONFIG_PROFILE_INBOUND_NOT_FOUND_IN_SPECIFIED_PROFILE);
                }
                configProfileUuid = configProfile.response.uuid;
                configProfileInboundUuid = configProfileInbound.uuid;
            }

            const hostEntity = new HostsEntity({
                ...rest,
                address: dto.address.trim(),
                isQwdtt,
                isAwg,
                xhttpExtraParams: nullifyEmpty(xhttpExtraParams),
                muxParams: nullifyEmpty(muxParams),
                sockoptParams: nullifyEmpty(sockoptParams),
                finalMask: nullifyEmpty(finalMask),
                configProfileUuid,
                configProfileInboundUuid,
                internalSquadsMode: internalSquads?.mode,
            });

            const result = await this.hostsRepository.create(hostEntity);

            if (nodes !== undefined && nodes.length > 0) {
                await this.hostsRepository.addNodesToHost(result.uuid, nodes);
                result.nodes = nodes.map((node) => {
                    return {
                        nodeUuid: node,
                    };
                });
            }

            if (internalSquads !== undefined && internalSquads.squads.length > 0) {
                await this.hostsRepository.addInternalSquadsToHost(
                    result.uuid,
                    internalSquads.squads,
                );
                result.internalSquads = internalSquads.squads.map((squad) => {
                    return {
                        squadUuid: squad,
                    };
                });
            }

            return ok(result);
        } catch (error) {
            this.logger.error(error);

            return fail(ERRORS.CREATE_HOST_ERROR);
        }
    }

    public async updateHost(dto: UpdateHostBodyDto): Promise<TResult<HostsEntity>> {
        try {
            const { inbound: inboundObj, nodes, internalSquads, ...rest } = dto;

            const host = await this.hostsRepository.findByUUID(dto.uuid);
            if (!host) return fail(ERRORS.HOST_NOT_FOUND);

            if (dto.xrayJsonTemplateUuid) {
                const xrayJsonTemplate = await this.queryBus.execute(
                    new GetSubscriptionTemplateByUuidQuery(dto.xrayJsonTemplateUuid),
                );

                if (!xrayJsonTemplate.isOk) {
                    return fail(ERRORS.SUBSCRIPTION_TEMPLATE_NOT_FOUND);
                }

                if (xrayJsonTemplate.response.templateType !== 'XRAY_JSON') {
                    return fail(ERRORS.TEMPLATE_TYPE_NOT_ALLOWED);
                }
            }

            let xhttpExtraParams: null | object | undefined;
            if (dto.xhttpExtraParams !== undefined && dto.xhttpExtraParams !== null) {
                xhttpExtraParams = dto.xhttpExtraParams;
            } else if (dto.xhttpExtraParams === null) {
                xhttpExtraParams = null;
            } else {
                xhttpExtraParams = undefined;
            }

            let muxParams: null | object | undefined;
            if (dto.muxParams !== undefined && dto.muxParams !== null) {
                if (Object.keys(dto.muxParams).length === 0) {
                    muxParams = null;
                } else {
                    muxParams = dto.muxParams;
                }
            } else if (dto.muxParams === null) {
                muxParams = null;
            } else {
                muxParams = undefined;
            }

            let sockoptParams: null | object | undefined;
            if (dto.sockoptParams !== undefined && dto.sockoptParams !== null) {
                if (Object.keys(dto.sockoptParams).length === 0) {
                    sockoptParams = null;
                } else {
                    sockoptParams = dto.sockoptParams;
                }
            } else if (dto.sockoptParams === null) {
                sockoptParams = null;
            } else {
                sockoptParams = undefined;
            }

            let serverDescription: null | string | undefined;
            if (dto.serverDescription !== undefined && dto.serverDescription !== null) {
                serverDescription = dto.serverDescription;
            } else if (dto.serverDescription === null) {
                serverDescription = null;
            } else {
                serverDescription = undefined;
            }

            let finalMask: null | object | undefined;
            if (dto.finalMask !== undefined && dto.finalMask !== null) {
                finalMask = dto.finalMask;
            } else if (dto.finalMask === null) {
                finalMask = null;
            } else {
                finalMask = undefined;
            }

            const isQwdtt = dto.isQwdtt ?? host.isQwdtt;
            const isAwg = dto.isAwg ?? host.isAwg;
            const sidecarKind = sidecarHostKind(isQwdtt, isAwg);
            let configProfileUuid: string | null | undefined;
            let configProfileInboundUuid: string | null | undefined;

            if (sidecarKind === 'conflict') {
                return fail(ERRORS.HOST_SIDECAR_TYPE_CONFLICT);
            }

            if (sidecarKind) {
                const nextNodes = nodes ?? host.nodes.map((node) => node.nodeUuid);
                if (nextNodes.length !== 1) {
                    return fail(sidecarHostNodeError(sidecarKind));
                }
                const address = (dto.address ?? host.address).trim();
                const port = dto.port ?? host.port;
                if (
                    (address && isPrivateOrLocalPeerHost(address)) ||
                    (address !== '' && isPrivateOrLocalPeerHost(`${address}:${port}`))
                ) {
                    return fail(sidecarHostPrivateError(sidecarKind));
                }
                configProfileUuid = null;
                configProfileInboundUuid = null;
            } else if (inboundObj) {
                const configProfile = await this.queryBus.execute(
                    new GetConfigProfileByUuidQuery(inboundObj.configProfileUuid),
                );

                if (!configProfile.isOk) {
                    return fail(ERRORS.CONFIG_PROFILE_NOT_FOUND);
                }

                const configProfileInbound = configProfile.response.inbounds.find(
                    (inbound) => inbound.uuid === inboundObj.configProfileInboundUuid,
                );

                if (!configProfileInbound) {
                    return fail(ERRORS.CONFIG_PROFILE_INBOUND_NOT_FOUND_IN_SPECIFIED_PROFILE);
                }

                configProfileUuid = configProfile.response.uuid;
                configProfileInboundUuid = configProfileInbound.uuid;
            }

            if (nodes !== undefined) {
                await this.hostsRepository.clearNodesFromHost(host.uuid);
                await this.hostsRepository.addNodesToHost(host.uuid, nodes);
            }

            if (internalSquads !== undefined) {
                await this.hostsRepository.clearInternalSquadsFromHost(host.uuid);
                await this.hostsRepository.addInternalSquadsToHost(
                    host.uuid,
                    internalSquads.squads,
                );
            }

            const result = await this.hostsRepository.update({
                ...rest,
                address: dto.address ? dto.address.trim() : undefined,
                isQwdtt,
                isAwg,
                xhttpExtraParams,
                muxParams,
                sockoptParams,
                configProfileUuid,
                configProfileInboundUuid,
                serverDescription,
                finalMask,
                internalSquadsMode: internalSquads?.mode,
            });

            return ok(result);
        } catch (error) {
            this.logger.error(error);

            return fail(ERRORS.UPDATE_HOST_ERROR);
        }
    }

    public async deleteHost(hostUuid: string): Promise<TResult<boolean>> {
        try {
            const host = await this.hostsRepository.findByUUID(hostUuid);
            if (!host) {
                return fail(ERRORS.HOST_NOT_FOUND);
            }
            await this.hostsRepository.deleteByUUID(host.uuid);

            return ok(true);
        } catch (error) {
            this.logger.error(error);
            this.logger.error(JSON.stringify(error));
            return fail(ERRORS.DELETE_HOST_ERROR);
        }
    }

    public async getHosts(): Promise<TResult<HostsEntity[]>> {
        try {
            const result = await this.hostsRepository.findAll();

            return ok(result);
        } catch (error) {
            this.logger.error(JSON.stringify(error));
            return fail(ERRORS.GET_ALL_HOSTS_ERROR);
        }
    }

    public async getHost(hostUuid: string): Promise<TResult<HostsEntity>> {
        try {
            const result = await this.hostsRepository.findByUUID(hostUuid);

            if (!result) {
                return fail(ERRORS.HOST_NOT_FOUND);
            }

            return ok(result);
        } catch (error) {
            this.logger.error(error);
            return fail(ERRORS.GET_ONE_HOST_ERROR);
        }
    }

    public async cloneHost(cloneFromUuid: string): Promise<TResult<HostsEntity>> {
        try {
            const host = await this.hostsRepository.findByUUID(cloneFromUuid);

            if (!host) {
                return fail(ERRORS.HOST_NOT_FOUND);
            }

            return ok(await this.cloneHostTransactional(host));
        } catch (error) {
            this.logger.error(error);

            return fail(ERRORS.CLONE_HOST_ERROR);
        }
    }

    @Transactional()
    private async cloneHostTransactional(host: HostsEntity): Promise<HostsEntity> {
        await this.hostsRepository.shiftViewPositionsAfter(host.viewPosition);

        const { uuid: _uuid, nodes, internalSquads, ...rest } = host;

        const clone = await this.hostsRepository.create(
            new HostsEntity({
                ...rest,
                remark: cloneString(host.remark),
                isDisabled: true,
                viewPosition: host.viewPosition + 1,
            }),
        );

        if (nodes.length > 0) {
            await this.hostsRepository.addNodesToHost(
                clone.uuid,
                nodes.map((node) => node.nodeUuid),
            );

            clone.nodes = nodes;
        }

        if (internalSquads.length > 0) {
            await this.hostsRepository.addInternalSquadsToHost(
                clone.uuid,
                internalSquads.map((internalSquad) => internalSquad.squadUuid),
            );

            clone.internalSquads = internalSquads;
        }

        await this.hostsRepository.syncViewPositionSequence();

        return clone;
    }

    public async reorderHosts(dto: ReorderHostsBodyDto): Promise<
        TResult<{
            isUpdated: boolean;
        }>
    > {
        try {
            const result = await this.hostsRepository.reorderMany(dto.hosts);

            return ok({ isUpdated: result });
        } catch (error) {
            this.logger.error(error);
            return fail(ERRORS.REORDER_HOSTS_ERROR);
        }
    }

    public async deleteHosts(uuids: string[]): Promise<TResult<boolean>> {
        try {
            await this.hostsRepository.deleteMany(uuids);

            return ok(true);
        } catch (error) {
            this.logger.error(error);
            return fail(ERRORS.DELETE_HOSTS_ERROR);
        }
    }

    public async bulkEnableHosts(uuids: string[]): Promise<TResult<boolean>> {
        try {
            await this.hostsRepository.enableMany(uuids);

            return ok(true);
        } catch (error) {
            this.logger.error(error);
            return fail(ERRORS.BULK_ENABLE_HOSTS_ERROR);
        }
    }

    public async bulkDisableHosts(uuids: string[]): Promise<TResult<boolean>> {
        try {
            await this.hostsRepository.disableMany(uuids);

            return ok(true);
        } catch (error) {
            this.logger.error(error);
            return fail(ERRORS.BULK_DISABLE_HOSTS_ERROR);
        }
    }

    public async getHostsTags(): Promise<TResult<string[]>> {
        try {
            const result = await this.hostsRepository.findAllTags();

            return ok(result);
        } catch (error) {
            this.logger.error(error);
            return fail(ERRORS.GET_ALL_HOST_TAGS_ERROR);
        }
    }

    public async updateManyHosts(dto: UpdateManyHostsBodyDto): Promise<TResult<boolean>> {
        try {
            const {
                uuids,
                inbound: inboundObj,
                nodes,
                internalSquads,
                xhttpExtraParams,
                muxParams,
                sockoptParams,
                finalMask,
                ...rest
            } = dto;

            if (dto.xrayJsonTemplateUuid) {
                const xrayJsonTemplate = await this.queryBus.execute(
                    new GetSubscriptionTemplateByUuidQuery(dto.xrayJsonTemplateUuid),
                );

                if (!xrayJsonTemplate.isOk) {
                    return fail(ERRORS.SUBSCRIPTION_TEMPLATE_NOT_FOUND);
                }

                if (xrayJsonTemplate.response.templateType !== 'XRAY_JSON') {
                    return fail(ERRORS.TEMPLATE_TYPE_NOT_ALLOWED);
                }
            }

            const shouldInspectHosts =
                dto.isQwdtt !== undefined ||
                dto.isAwg !== undefined ||
                dto.address !== undefined ||
                nodes !== undefined;
            const existingHosts = shouldInspectHosts
                ? await this.hostsRepository.findByUuids(uuids)
                : [];

            const addressIsPrivate = (address: string, port: number | undefined): boolean => {
                const trimmed = address.trim();
                if (!trimmed) {
                    return false;
                }
                if (isPrivateOrLocalPeerHost(trimmed)) {
                    return true;
                }
                return port !== undefined && isPrivateOrLocalPeerHost(`${trimmed}:${port}`);
            };

            if (dto.isQwdtt === true && dto.isAwg === true) {
                return fail(ERRORS.HOST_SIDECAR_TYPE_CONFLICT);
            }
            if (
                dto.isQwdtt === true &&
                dto.isAwg !== false &&
                existingHosts.some((host) => host.isAwg)
            ) {
                return fail(ERRORS.HOST_SIDECAR_TYPE_CONFLICT);
            }
            if (
                dto.isAwg === true &&
                dto.isQwdtt !== false &&
                existingHosts.some((host) => host.isQwdtt)
            ) {
                return fail(ERRORS.HOST_SIDECAR_TYPE_CONFLICT);
            }

            if (dto.isQwdtt === true || dto.isAwg === true) {
                const kind: TSidecarHostKind = dto.isAwg === true ? 'awg' : 'qwdtt';
                if (!nodes || nodes.length !== 1) {
                    return fail(sidecarHostNodeError(kind));
                }
                if (dto.address !== undefined && addressIsPrivate(dto.address, dto.port)) {
                    return fail(sidecarHostPrivateError(kind));
                }
            } else if (dto.isQwdtt === false || dto.isAwg === false) {
                if (!inboundObj?.configProfileUuid || !inboundObj?.configProfileInboundUuid) {
                    return fail(ERRORS.CONFIG_PROFILE_INBOUND_NOT_FOUND_IN_SPECIFIED_PROFILE);
                }
            } else if (existingHosts.some((host) => host.isQwdtt)) {
                if (nodes !== undefined && nodes.length !== 1) {
                    return fail(ERRORS.QWDTT_HOST_NODE_REQUIRED);
                }
                if (dto.address !== undefined && addressIsPrivate(dto.address, dto.port)) {
                    return fail(ERRORS.QWDTT_HOST_PRIVATE_PEER);
                }
            } else if (existingHosts.some((host) => host.isAwg)) {
                if (nodes !== undefined && nodes.length !== 1) {
                    return fail(ERRORS.AWG_HOST_NODE_REQUIRED);
                }
                if (dto.address !== undefined && addressIsPrivate(dto.address, dto.port)) {
                    return fail(ERRORS.AWG_HOST_PRIVATE_PEER);
                }
            }

            let configProfileUuid: string | null | undefined;
            let configProfileInboundUuid: string | null | undefined;
            if (dto.isQwdtt === true || dto.isAwg === true) {
                configProfileUuid = null;
                configProfileInboundUuid = null;
            } else if (inboundObj) {
                const configProfile = await this.queryBus.execute(
                    new GetConfigProfileByUuidQuery(inboundObj.configProfileUuid),
                );

                if (!configProfile.isOk) {
                    return fail(ERRORS.CONFIG_PROFILE_NOT_FOUND);
                }

                const configProfileInbound = configProfile.response.inbounds.find(
                    (inbound) => inbound.uuid === inboundObj.configProfileInboundUuid,
                );

                if (!configProfileInbound) {
                    return fail(ERRORS.CONFIG_PROFILE_INBOUND_NOT_FOUND_IN_SPECIFIED_PROFILE);
                }

                configProfileUuid = configProfile.response.uuid;
                configProfileInboundUuid = configProfileInbound.uuid;
            }

            if (nodes !== undefined) {
                await this.hostsRepository.clearNodesFromHosts(uuids);
                await this.hostsRepository.addNodesToHosts(uuids, nodes);
            }

            if (internalSquads !== undefined) {
                await this.hostsRepository.clearInternalSquadsFromHosts(uuids);
                await this.hostsRepository.addInternalSquadsToHosts(uuids, internalSquads.squads);
            }

            await this.hostsRepository.updateMany({
                uuids,
                data: {
                    ...rest,
                    address: dto.address ? dto.address.trim() : undefined,
                    xhttpExtraParams: nullifyEmpty(xhttpExtraParams),
                    muxParams: nullifyEmpty(muxParams),
                    sockoptParams: nullifyEmpty(sockoptParams),
                    finalMask: nullifyEmpty(finalMask),
                    configProfileUuid,
                    configProfileInboundUuid,
                    internalSquadsMode: internalSquads?.mode,
                },
            });

            return ok(true);
        } catch (error) {
            this.logger.error(error);
            return fail(ERRORS.UPDATE_HOSTS_ERROR);
        }
    }
}
