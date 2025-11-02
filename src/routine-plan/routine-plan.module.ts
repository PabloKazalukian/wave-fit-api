import { Module } from '@nestjs/common';
import { RoutinePlanService } from './routine-plan.service';
import { RoutinePlanResolver } from './routine-plan.resolver';

@Module({
  providers: [RoutinePlanResolver, RoutinePlanService],
})
export class RoutinePlanModule {}
