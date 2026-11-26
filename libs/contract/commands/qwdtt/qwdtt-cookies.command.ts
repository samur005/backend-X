import { z } from 'zod';

import { QWDTT_ROUTES, REST_API } from '../../api';
import { getEndpointDetails } from '../../constants';
import { QwdttViewSchema } from '../../models';

export namespace SaveQwdttCookiesCommand {
    export const url = REST_API.QWDTT.COOKIES;
    export const TSQ_url = url;

    export const endpointDetails = getEndpointDetails(
        QWDTT_ROUTES.COOKIES,
        'put',
        'Save VK cookies used to create qWDTT call hashes',
        { scope: 'update', kind: 'write' },
    );

    export const RequestSchema = z.object({
        cookies: z.string().min(1),
    });
    export type Request = z.infer<typeof RequestSchema>;
    export const RequestBodySchema = RequestSchema;

    export const ResponseSchema = z.object({
        response: QwdttViewSchema,
    });
    export type Response = z.infer<typeof ResponseSchema>;
}

export namespace ClearQwdttCookiesCommand {
    export const url = REST_API.QWDTT.CLEAR_COOKIES;
    export const TSQ_url = url;

    export const endpointDetails = getEndpointDetails(
        QWDTT_ROUTES.CLEAR_COOKIES,
        'delete',
        'Clear stored VK cookies',
        { scope: 'delete', kind: 'write' },
    );

    export const ResponseSchema = z.object({
        response: QwdttViewSchema,
    });
    export type Response = z.infer<typeof ResponseSchema>;
}

export namespace CheckQwdttCookiesCommand {
    export const url = REST_API.QWDTT.CHECK_COOKIES;
    export const TSQ_url = url;

    export const endpointDetails = getEndpointDetails(
        QWDTT_ROUTES.CHECK_COOKIES,
        'post',
        'Check whether stored VK cookies still open a session',
        { scope: 'read', kind: 'read' },
    );

    export const ResponseSchema = z.object({
        response: z.object({
            ok: z.boolean(),
            error: z.string().optional(),
        }),
    });
    export type Response = z.infer<typeof ResponseSchema>;
}
