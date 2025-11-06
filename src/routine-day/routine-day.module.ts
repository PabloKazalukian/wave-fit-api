import { Module } from '@nestjs/common';
import { RoutineDayService } from './routine-day.service';
import { RoutineDayResolver } from './routine-day.resolver';

@Module({
  providers: [RoutineDayResolver, RoutineDayService],
})
export class RoutineDayModule {}
