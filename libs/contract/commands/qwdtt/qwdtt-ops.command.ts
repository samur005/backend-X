import { z } from 'zod';

import { QWDTT_ROUTES, REST_API } from '../../api';
import { getEndpointDetails } from '../../constants';
import { QwdttNodeStatusSchema, QwdttViewSchema } from '../../models';

export namespace RestartQwdttCommand {
    export const url = REST_API.QWDTT.RESTART;
    export const TSQ_url = url;

    export const endpointDetails = getEndpointDetails(
        QWDTT_ROUTES.RESTART,
        'post',
        'Reconcile qWDTT sidecars on assigned nodes',
        { scope: 'update', kind: 'write' },
    );

    export const ResponseSchema = z.object({
        response: QwdttViewSchema.extend({
            nodes: z.array(QwdttNodeStatusSchema),
        }),
    });
    export type Response = z.infer<typeof ResponseSchema>;
}

export namespace GetQwdttNodeStatusCommand {
    export const url = REST_API.QWDTT.NODE_STATUS;
    export const TSQ_url = url;

    export const endpointDetails = getEndpointDetails(
        QWDTT_ROUTES.NODE_STATUS,
        'get',
        'Get qWDTT sidecar status from assigned nodes',
        { scope: 'read', kind: 'read' },
    );

    export const ResponseSchema = z.object({
        response: z.array(QwdttNodeStatusSchema),
    });
    export type Response = z.infer<typeof ResponseSchema>;
}

export namespace GetQwdttSubscriptionPreviewCommand {
    export const url = REST_API.QWDTT.SUBSCRIPTION;
    export const TSQ_url = url;

    export const endpointDetails = getEndpointDetails(
        QWDTT_ROUTES.SUBSCRIPTION,
        'get',
        'Preview the qWDTT JSON subscription document',
        { scope: 'read', kind: 'read' },
    );

    export const ResponseSchema = z.object({
        response: z.object({
            document: z.string(),
        }),
    });
    export type Response = z.infer<typeof ResponseSchema>;
}
