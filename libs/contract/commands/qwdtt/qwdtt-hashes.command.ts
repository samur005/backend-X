import { z } from 'zod';

import { QWDTT_ROUTES, REST_API } from '../../api';
import { getEndpointDetails } from '../../constants';
import { QwdttHashStatusSchema, QwdttViewSchema } from '../../models';

export namespace GenerateQwdttHashCommand {
    export const url = REST_API.QWDTT.GENERATE_HASH;
    export const TSQ_url = url;

    export const endpointDetails = getEndpointDetails(
        QWDTT_ROUTES.GENERATE_HASH,
        'post',
        'Create a VK call and add its hash',
        { scope: 'update', kind: 'write' },
    );

    export const RequestSchema = z.object({
        replaceOldest: z.boolean().optional(),
    });
    export type Request = z.infer<typeof RequestSchema>;
    export const RequestBodySchema = RequestSchema;

    export const ResponseSchema = z.object({
        response: QwdttViewSchema.extend({
            generatedHash: z.string(),
        }),
    });
    export type Response = z.infer<typeof ResponseSchema>;
}

export namespace CheckQwdttHashesCommand {
    export const url = REST_API.QWDTT.CHECK_HASHES;
    export const TSQ_url = url;

    export const endpointDetails = getEndpointDetails(
        QWDTT_ROUTES.CHECK_HASHES,
        'get',
        'Check whether configured VK call hashes are still alive',
        { scope: 'read', kind: 'read' },
    );

    export const ResponseSchema = z.object({
        response: z.array(QwdttHashStatusSchema),
    });
    export type Response = z.infer<typeof ResponseSchema>;
}
