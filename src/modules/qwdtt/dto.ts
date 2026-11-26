import { createZodDto } from 'nestjs-zod';

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

export class GetQwdttResponseDto extends createZodDto(GetQwdttCommand.ResponseSchema) {}
export class UpdateQwdttBodyDto extends createZodDto(UpdateQwdttCommand.RequestBodySchema) {}
export class UpdateQwdttResponseDto extends createZodDto(UpdateQwdttCommand.ResponseSchema) {}
export class SaveQwdttCookiesBodyDto extends createZodDto(
    SaveQwdttCookiesCommand.RequestBodySchema,
) {}
export class SaveQwdttCookiesResponseDto extends createZodDto(
    SaveQwdttCookiesCommand.ResponseSchema,
) {}
export class ClearQwdttCookiesResponseDto extends createZodDto(
    ClearQwdttCookiesCommand.ResponseSchema,
) {}
export class CheckQwdttCookiesResponseDto extends createZodDto(
    CheckQwdttCookiesCommand.ResponseSchema,
) {}
export class GenerateQwdttHashBodyDto extends createZodDto(
    GenerateQwdttHashCommand.RequestBodySchema,
) {}
export class GenerateQwdttHashResponseDto extends createZodDto(
    GenerateQwdttHashCommand.ResponseSchema,
) {}
export class CheckQwdttHashesResponseDto extends createZodDto(
    CheckQwdttHashesCommand.ResponseSchema,
) {}
export class GetQwdttUsersResponseDto extends createZodDto(GetQwdttUsersCommand.ResponseSchema) {}
export class UpsertQwdttUserBodyDto extends createZodDto(
    UpsertQwdttUserCommand.RequestBodySchema,
) {}
export class UpsertQwdttUserResponseDto extends createZodDto(
    UpsertQwdttUserCommand.ResponseSchema,
) {}
export class DeleteQwdttUserParamDto extends createZodDto(
    DeleteQwdttUserCommand.RequestParamSchema,
) {}
export class DeleteQwdttUserResponseDto extends createZodDto(
    DeleteQwdttUserCommand.ResponseSchema,
) {}
export class GetQwdttUserLinkParamDto extends createZodDto(
    GetQwdttUserLinkCommand.RequestParamSchema,
) {}
export class GetQwdttUserLinkResponseDto extends createZodDto(
    GetQwdttUserLinkCommand.ResponseSchema,
) {}
export class RestartQwdttResponseDto extends createZodDto(RestartQwdttCommand.ResponseSchema) {}
export class GetQwdttNodeStatusResponseDto extends createZodDto(
    GetQwdttNodeStatusCommand.ResponseSchema,
) {}
export class GetQwdttSubscriptionPreviewResponseDto extends createZodDto(
    GetQwdttSubscriptionPreviewCommand.ResponseSchema,
) {}
