import { Module } from '@nestjs/common';
import { RoutinePlanService } from './routine-plan.service';
import { RoutinePlanResolver } from './routine-plan.resolver';
import { RoutinePlan, RoutinePlanSchema } from './schema/routine-plan.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { RoutineDayModule } from '../routine-day/routine-day.module';
import { AuditLogsModule } from 'src/modules/audit-logs/audit-logs.module';

@Module({
  imports: [
    RoutineDayModule,
    MongooseModule.forFeature([
      { name: RoutinePlan.name, schema: RoutinePlanSchema },
    ]),
    AuditLogsModule,
  ],
  providers: [RoutinePlanResolver, RoutinePlanService],
})
export class RoutinePlanModule {}
