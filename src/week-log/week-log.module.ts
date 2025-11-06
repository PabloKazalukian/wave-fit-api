import { Module } from '@nestjs/common';
import { WeekLogService } from './week-log.service';
import { WeekLogResolver } from './week-log.resolver';

@Module({
  providers: [WeekLogResolver, WeekLogService],
})
export class WeekLogModule {}
