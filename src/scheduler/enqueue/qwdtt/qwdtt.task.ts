import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { QwdttService } from '@modules/qwdtt/qwdtt.service';

import { JOBS_INTERVALS } from '../../intervals';

@Injectable()
export class QwdttTask {
    private static readonly CRON_NAME = 'qwdttMaintenance';
    private readonly logger = new Logger(QwdttTask.name);

    constructor(private readonly qwdttService: QwdttService) {}

    @Cron(JOBS_INTERVALS.QWDTT_MAINTENANCE, {
        name: QwdttTask.CRON_NAME,
        waitForCompletion: true,
    })
    async handleCron() {
        try {
            const changed = await this.qwdttService.maintainHashes();
            if (changed) {
                await this.qwdttService.syncAssignedNodes();
            }
            await this.qwdttService.collectTraffic();
        } catch (error) {
            this.logger.warn(`qwdtt maintenance: ${error}`);
        }
    }
}
