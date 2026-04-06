import { Module } from '@nestjs/common';
import { DayLogService } from './day-log.service';
import { DayLogResolver } from './day-log.resolver';

@Module({
  providers: [DayLogResolver, DayLogService],
})
export class DayLogModule {}
