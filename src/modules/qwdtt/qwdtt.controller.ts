import { CONTROLLERS_INFO, QWDTT_CONTROLLER } from '@contract/api';
import { ROLE } from '@contract/constants';

import { Body, Controller, HttpStatus, Param, UseFilters, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Endpoint } from '@common/decorators/base-endpoint';
import { Roles } from '@common/decorators/roles/roles';
import { HttpExceptionFilter } from '@common/exception/http-exception.filter';
import { JwtDefaultGuard } from '@common/guards/jwt-guards/def-jwt-guard';
import { RolesGuard } from '@common/guards/roles';
import { errorHandler } from '@common/helpers/error-handler.helper';
import {
    CheckQwdttCookiesCommand,
    CheckQwdttHashesCommand,
    ClearQwdttCookiesCommand,
    DeleteQwdttUserCommand,
    GenerateQwdttHashCommand,
    GetQwdttCommand,
    GetQwdttNodeStatusCommand,
    GetQwdttSubscriptionPreviewCommand,
    GetQwdttUserLinkCommand,
    GetQwdttUsersCommand,
    RestartQwdttCommand,
    SaveQwdttCookiesCommand,
    UpdateQwdttCommand,
    UpsertQwdttUserCommand,
} from '@libs/contracts/commands';

import {
    CheckQwdttCookiesResponseDto,
    CheckQwdttHashesResponseDto,
    ClearQwdttCookiesResponseDto,
    DeleteQwdttUserParamDto,
    DeleteQwdttUserResponseDto,
    GenerateQwdttHashBodyDto,
    GenerateQwdttHashResponseDto,
    GetQwdttNodeStatusResponseDto,
    GetQwdttResponseDto,
    GetQwdttSubscriptionPreviewResponseDto,
    GetQwdttUserLinkParamDto,
    GetQwdttUserLinkResponseDto,
    GetQwdttUsersResponseDto,
    RestartQwdttResponseDto,
    SaveQwdttCookiesBodyDto,
    SaveQwdttCookiesResponseDto,
    UpdateQwdttBodyDto,
    UpdateQwdttResponseDto,
    UpsertQwdttUserBodyDto,
    UpsertQwdttUserResponseDto,
} from './dto';
import { QwdttService } from './qwdtt.service';

@ApiBearerAuth('Authorization')
@ApiTags(CONTROLLERS_INFO.QWDTT.tag)
@Roles(ROLE.ADMIN)
@UseGuards(JwtDefaultGuard, RolesGuard)
@UseFilters(HttpExceptionFilter)
@Controller(QWDTT_CONTROLLER)
export class QwdttController {
    constructor(private readonly qwdttService: QwdttService) {}

    @Endpoint({ command: GetQwdttCommand, httpCode: HttpStatus.OK, type: GetQwdttResponseDto })
    async getView(): Promise<GetQwdttResponseDto> {
        return { response: errorHandler(await this.qwdttService.getView()) };
    }

    @Endpoint({
        command: UpdateQwdttCommand,
        httpCode: HttpStatus.OK,
        type: UpdateQwdttResponseDto,
    })
    async update(@Body() body: UpdateQwdttBodyDto): Promise<UpdateQwdttResponseDto> {
        return { response: errorHandler(await this.qwdttService.updateSettings(body)) };
    }

    @Endpoint({
        command: SaveQwdttCookiesCommand,
        httpCode: HttpStatus.OK,
        type: SaveQwdttCookiesResponseDto,
    })
    async saveCookies(@Body() body: SaveQwdttCookiesBodyDto): Promise<SaveQwdttCookiesResponseDto> {
        return { response: errorHandler(await this.qwdttService.saveCookies(body.cookies)) };
    }

    @Endpoint({
        command: ClearQwdttCookiesCommand,
        httpCode: HttpStatus.OK,
        type: ClearQwdttCookiesResponseDto,
    })
    async clearCookies(): Promise<ClearQwdttCookiesResponseDto> {
        return { response: errorHandler(await this.qwdttService.clearCookies()) };
    }

    @Endpoint({
        command: CheckQwdttCookiesCommand,
        httpCode: HttpStatus.OK,
        type: CheckQwdttCookiesResponseDto,
    })
    async checkCookies(): Promise<CheckQwdttCookiesResponseDto> {
        return { response: errorHandler(await this.qwdttService.checkCookies()) };
    }

    @Endpoint({
        command: GenerateQwdttHashCommand,
        httpCode: HttpStatus.OK,
        type: GenerateQwdttHashResponseDto,
    })
    async generateHash(
        @Body() body: GenerateQwdttHashBodyDto,
    ): Promise<GenerateQwdttHashResponseDto> {
        return { response: errorHandler(await this.qwdttService.generateHash(body.replaceOldest)) };
    }

    @Endpoint({
        command: CheckQwdttHashesCommand,
        httpCode: HttpStatus.OK,
        type: CheckQwdttHashesResponseDto,
    })
    async checkHashes(): Promise<CheckQwdttHashesResponseDto> {
        return { response: errorHandler(await this.qwdttService.checkHashes()) };
    }

    @Endpoint({
        command: GetQwdttUsersCommand,
        httpCode: HttpStatus.OK,
        type: GetQwdttUsersResponseDto,
    })
    async listUsers(): Promise<GetQwdttUsersResponseDto> {
        return { response: errorHandler(await this.qwdttService.listUsers()) };
    }

    @Endpoint({
        command: UpsertQwdttUserCommand,
        httpCode: HttpStatus.OK,
        type: UpsertQwdttUserResponseDto,
    })
    async upsertUser(@Body() body: UpsertQwdttUserBodyDto): Promise<UpsertQwdttUserResponseDto> {
        return { response: errorHandler(await this.qwdttService.upsertUser(body)) };
    }

    @Endpoint({
        command: DeleteQwdttUserCommand,
        httpCode: HttpStatus.OK,
        type: DeleteQwdttUserResponseDto,
    })
    async deleteUser(@Param() param: DeleteQwdttUserParamDto): Promise<DeleteQwdttUserResponseDto> {
        return { response: errorHandler(await this.qwdttService.deleteUser(Number(param.userId))) };
    }

    @Endpoint({
        command: GetQwdttUserLinkCommand,
        httpCode: HttpStatus.OK,
        type: GetQwdttUserLinkResponseDto,
    })
    async userLink(@Param() param: GetQwdttUserLinkParamDto): Promise<GetQwdttUserLinkResponseDto> {
        return {
            response: errorHandler(await this.qwdttService.getUserLink(Number(param.userId))),
        };
    }

    @Endpoint({
        command: RestartQwdttCommand,
        httpCode: HttpStatus.OK,
        type: RestartQwdttResponseDto,
    })
    async restart(): Promise<RestartQwdttResponseDto> {
        return { response: errorHandler(await this.qwdttService.restartAndStatus()) };
    }

    @Endpoint({
        command: GetQwdttNodeStatusCommand,
        httpCode: HttpStatus.OK,
        type: GetQwdttNodeStatusResponseDto,
    })
    async nodeStatus(): Promise<GetQwdttNodeStatusResponseDto> {
        return { response: errorHandler(await this.qwdttService.nodeStatuses()) };
    }

    @Endpoint({
        command: GetQwdttSubscriptionPreviewCommand,
        httpCode: HttpStatus.OK,
        type: GetQwdttSubscriptionPreviewResponseDto,
    })
    async subscriptionPreview(): Promise<GetQwdttSubscriptionPreviewResponseDto> {
        return { response: errorHandler(await this.qwdttService.getAdminSubscriptionPreview()) };
    }
}
