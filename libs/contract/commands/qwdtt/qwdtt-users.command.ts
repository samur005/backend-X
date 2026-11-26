import { z } from 'zod';

import { QWDTT_ROUTES, REST_API } from '../../api';
import { getEndpointDetails } from '../../constants';
import { QwdttUserAccessSchema } from '../../models';

export namespace GetQwdttUsersCommand {
    export const url = REST_API.QWDTT.USERS;
    export const TSQ_url = url;

    export const endpointDetails = getEndpointDetails(
        QWDTT_ROUTES.USERS,
        'get',
        'List users with qWDTT access',
        { scope: 'read', kind: 'read' },
    );

    export const ResponseSchema = z.object({
        response: z.array(QwdttUserAccessSchema),
    });
    export type Response = z.infer<typeof ResponseSchema>;
}

export namespace UpsertQwdttUserCommand {
    export const url = REST_API.QWDTT.UPSERT_USER;
    export const TSQ_url = url;

    export const endpointDetails = getEndpointDetails(
        QWDTT_ROUTES.UPSERT_USER,
        'put',
        'Grant or update qWDTT access for a user',
        { scope: 'update', kind: 'write' },
    );

    export const RequestSchema = z.object({
        userId: z.number().int().optional(),
        username: z.string().optional(),
        enabled: z.boolean().optional(),
        rotatePassword: z.boolean().optional(),
    });
    export type Request = z.infer<typeof RequestSchema>;
    export const RequestBodySchema = RequestSchema;

    export const ResponseSchema = z.object({
        response: QwdttUserAccessSchema,
    });
    export type Response = z.infer<typeof ResponseSchema>;
}

export namespace DeleteQwdttUserCommand {
    export const url = REST_API.QWDTT.DELETE_USER;
    export const TSQ_url = url(':userId');

    export const endpointDetails = getEndpointDetails(
        QWDTT_ROUTES.DELETE_USER(':userId'),
        'delete',
        'Revoke qWDTT access for a user',
        { scope: 'delete', kind: 'write' },
    );

    export const RequestParamSchema = z.object({
        userId: z.string(),
    });
    export type RequestParam = z.infer<typeof RequestParamSchema>;

    export const ResponseSchema = z.object({
        response: z.object({
            ok: z.boolean(),
        }),
    });
    export type Response = z.infer<typeof ResponseSchema>;
}

export namespace GetQwdttUserLinkCommand {
    export const url = REST_API.QWDTT.USER_LINK;
    export const TSQ_url = url(':userId');

    export const endpointDetails = getEndpointDetails(
        QWDTT_ROUTES.USER_LINK(':userId'),
        'get',
        'Get a user qwdtt:// link and JSON subscription',
        { scope: 'read', kind: 'read' },
    );

    export const RequestParamSchema = z.object({
        userId: z.string(),
    });
    export type RequestParam = z.infer<typeof RequestParamSchema>;

    export const ResponseSchema = z.object({
        response: z.object({
            link: z.string(),
            subscription: z.string(),
        }),
    });
    export type Response = z.infer<typeof ResponseSchema>;
}
