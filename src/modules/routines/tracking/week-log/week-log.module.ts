import { Module, forwardRef } from '@nestjs/common';
import { WeekLogService } from './week-log.service';
import { WeekLogResolver } from './week-log.resolver';
import { MongooseModule } from '@nestjs/mongoose';
import {
  WeekLog,
  WeekLogSchema,
} from './infrastructure/schemas/week-log.schema';
import {
  WorkoutSession,
  WorkoutSessionSchema,
} from '../workout-session/schema/workout-session.schema';
import { WorkoutSessionModule } from '../workout-session/workout-session.module';
import { RoutinePlanModule } from '../../templates/routine-plan/routine-plan.module';
import {
  RoutinePlan,
  RoutinePlanSchema,
} from '../../templates/routine-plan/schema/routine-plan.schema';
import { RoutineDayModule } from '../../templates/routine-day/routine-day.module';
import { AuditLogsModule } from 'src/modules/audit-logs/audit-logs.module';
import { WeekLogValidator } from './application/validators/week-log.validator';
import { WeekLogRepository } from './infrastructure/repositories/week-log.repository';
import { WEEK_LOG_REPOSITORY } from './domain/interfaces/repositories/week-log.repository.interface';
import { WEEK_LOG_USE_CASES } from './application/use-cases';

@Module({
  imports: [
    forwardRef(() => WorkoutSessionModule),
    RoutinePlanModule,
    RoutineDayModule,
    MongooseModule.forFeature([
      { name: WeekLog.name, schema: WeekLogSchema },
      { name: WorkoutSession.name, schema: WorkoutSessionSchema },
      { name: RoutinePlan.name, schema: RoutinePlanSchema },
    ]),

    AuditLogsModule,
  ],
  providers: [
    WeekLogResolver,
    WeekLogService,
    WeekLogValidator,
    ...WEEK_LOG_USE_CASES,
    {
      provide: WEEK_LOG_REPOSITORY,
      useClass: WeekLogRepository,
    },
  ],
  exports: [WeekLogService],
})
export class WeekLogModule {}
