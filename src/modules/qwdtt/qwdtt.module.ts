import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { QUERIES } from './queries';
import { QwdttController } from './qwdtt.controller';
import { QwdttRepository } from './qwdtt.repository';
import { QwdttService } from './qwdtt.service';

@Module({
    imports: [CqrsModule],
    controllers: [QwdttController],
    providers: [QwdttService, QwdttRepository, ...QUERIES],
    exports: [QwdttService],
})
export class QwdttModule {}
