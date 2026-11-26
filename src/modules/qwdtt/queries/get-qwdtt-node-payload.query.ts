import { Query, QueryHandler } from '@nestjs/cqrs';
import { IQueryHandler } from '@nestjs/cqrs';

import { INodeQwdttSyncRequest } from '@common/axios/qwdtt-node.contract';

import { QwdttService } from '../qwdtt.service';

export class GetQwdttNodePayloadQuery extends Query<INodeQwdttSyncRequest | null> {
    constructor(public readonly nodeUuid: string) {
        super();
    }
}

@QueryHandler(GetQwdttNodePayloadQuery)
export class GetQwdttNodePayloadHandler implements IQueryHandler<GetQwdttNodePayloadQuery> {
    constructor(private readonly qwdttService: QwdttService) {}

    async execute(query: GetQwdttNodePayloadQuery): Promise<INodeQwdttSyncRequest | null> {
        return this.qwdttService.getNodePayload(query.nodeUuid);
    }
}
