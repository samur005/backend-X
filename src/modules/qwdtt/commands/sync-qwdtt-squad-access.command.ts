import { Logger } from '@nestjs/common';
import { Command, CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { QwdttService } from '../qwdtt.service';

export class SyncQwdttSquadAccessCommand extends Command<void> {
    constructor() {
        super();
    }
}

@CommandHandler(SyncQwdttSquadAccessCommand)
export class SyncQwdttSquadAccessHandler implements ICommandHandler<SyncQwdttSquadAccessCommand> {
    private readonly logger = new Logger(SyncQwdttSquadAccessHandler.name);

    constructor(private readonly qwdttService: QwdttService) {}

    async execute(): Promise<void> {
        try {
            await this.qwdttService.syncAccessFromSquads();
        } catch (error) {
            this.logger.error(error);
            throw error;
        }
    }
}
