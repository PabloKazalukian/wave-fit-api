import { Module } from '@nestjs/common';
import { RoutinePlanService } from './routine-plan.service';
import { RoutinePlanResolver } from './routine-plan.resolver';
import { RoutinePlan, RoutinePlanSchema } from './schema/routine-plan.schema';
import {
  UserTrainingPreference,
  UserTrainingPreferenceSchema,
} from 'src/modules/user/user-profile/schema/training-preference.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { RoutineDayModule } from '../routine-day/routine-day.module';
import { AuditLogsModule } from 'src/modules/audit-logs/audit-logs.module';

@Module({
  imports: [
    RoutineDayModule,
    MongooseModule.forFeature([
      { name: RoutinePlan.name, schema: RoutinePlanSchema },
      {
        name: UserTrainingPreference.name,
        schema: UserTrainingPreferenceSchema,
      },
    ]),
    AuditLogsModule,
  ],
  providers: [RoutinePlanResolver, RoutinePlanService],
  exports: [RoutinePlanService],
})
export class RoutinePlanModule {}
