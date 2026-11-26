import { z } from 'zod';

import { QWDTT_ROUTES, REST_API } from '../../api';
import { getEndpointDetails } from '../../constants';
import { QwdttViewSchema } from '../../models';

export namespace GetQwdttCommand {
    export const url = REST_API.QWDTT.GET;
    export const TSQ_url = url;

    export const endpointDetails = getEndpointDetails(
        QWDTT_ROUTES.GET,
        'get',
        'Get qWDTT configuration and status',
        { scope: 'read', kind: 'read' },
    );

    export const ResponseSchema = z.object({
        response: QwdttViewSchema,
    });

    export type Response = z.infer<typeof ResponseSchema>;
}
