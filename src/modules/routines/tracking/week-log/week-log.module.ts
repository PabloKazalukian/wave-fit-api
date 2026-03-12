import { Module } from '@nestjs/common';
import { WeekLogService } from './week-log.service';
import { WeekLogResolver } from './week-log.resolver';
import { MongooseModule } from '@nestjs/mongoose';
import { WeekLog, WeekLogSchema } from './schema/week-log.schema';
import { WeekLogValidator } from './week-log.validator';
import {
  WorkoutSession,
  WorkoutSessionSchema,
} from '../workout-session/schema/workout-session.schema';
import { RoutinePlanModule } from '../../templates/routine-plan/routine-plan.module';
import {
  RoutinePlan,
  RoutinePlanSchema,
} from '../../templates/routine-plan/schema/routine-plan.schema';

@Module({
  imports: [
    RoutinePlanModule,
    MongooseModule.forFeature([
      { name: WeekLog.name, schema: WeekLogSchema },
      { name: WorkoutSession.name, schema: WorkoutSessionSchema },
      { name: RoutinePlan.name, schema: RoutinePlanSchema },
    ]),
  ],
  providers: [WeekLogResolver, WeekLogService, WeekLogValidator],
  exports: [WeekLogService],
})
export class WeekLogModule {}
