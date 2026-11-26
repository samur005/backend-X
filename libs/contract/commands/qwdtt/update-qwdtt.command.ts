import { z } from 'zod';

import { QWDTT_ROUTES, REST_API } from '../../api';
import { getEndpointDetails } from '../../constants';
import { QwdttViewSchema } from '../../models';

export namespace UpdateQwdttCommand {
    export const url = REST_API.QWDTT.UPDATE;
    export const TSQ_url = url;

    export const endpointDetails = getEndpointDetails(
        QWDTT_ROUTES.UPDATE,
        'patch',
        'Update qWDTT configuration',
        { scope: 'update', kind: 'write' },
    );

    export const RequestSchema = z.object({
        enabled: z.boolean().optional(),
        remark: z.string().optional(),
        listenAddr: z.string().optional(),
        wgPort: z.number().int().min(1).max(65535).optional(),
        dns: z.string().optional(),
        listenRaw: z.string().optional(),
        listenDirect: z.string().optional(),
        subHost: z.string().optional(),
        vkHashes: z.string().optional(),
        clientPort: z.number().int().min(1).max(65535).optional(),
        workers: z.number().int().min(1).max(64).optional(),
        autoVkHash: z.boolean().optional(),
        nodeUuids: z.array(z.uuid()).optional(),
        remoteWdttUrl: z.string().optional(),
        remoteWdttCookie: z.string().optional(),
        remoteWdttCsrfToken: z.string().optional(),
        syncNodes: z.boolean().optional(),
    });

    export type Request = z.infer<typeof RequestSchema>;
    export const RequestBodySchema = RequestSchema;

    export const ResponseSchema = z.object({
        response: QwdttViewSchema,
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
