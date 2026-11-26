import { IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { QwdttService } from '../qwdtt.service';

export class GetQwdttUserLinkQuery extends Query<string[]> {
    constructor(public readonly userId: bigint) {
        super();
    }
}

@QueryHandler(GetQwdttUserLinkQuery)
export class GetQwdttUserLinkHandler implements IQueryHandler<GetQwdttUserLinkQuery> {
    constructor(private readonly qwdttService: QwdttService) {}

    async execute(query: GetQwdttUserLinkQuery): Promise<string[]> {
        return this.qwdttService.getPublicLinksForUser(query.userId);
    }
}
