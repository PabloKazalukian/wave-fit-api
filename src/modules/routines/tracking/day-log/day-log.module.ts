import { Module, forwardRef } from '@nestjs/common';
import { DayLogService } from './day-log.service';
import { DayLogResolver } from './day-log.resolver';
import { MongooseModule } from '@nestjs/mongoose';
import { DayLog, DayLogSchema } from './infrastructure/schemas/day-log.schema';
import {
  WorkoutSession,
  WorkoutSessionSchema,
} from '../workout-session/schema/workout-session.schema';
import { WorkoutSessionModule } from '../workout-session/workout-session.module';
import { RoutineDayModule } from '../../templates/routine-day/routine-day.module';
import {
  RoutinePlan,
  RoutinePlanSchema,
} from '../../templates/routine-plan/schema/routine-plan.schema';
import { AuditLogsModule } from 'src/modules/audit-logs/audit-logs.module';
import { DayLogValidator } from './application/validators/day-log.validator';
import { DayLogRepository } from './infrastructure/repositories/day-log.repository';
import { DAY_LOG_REPOSITORY } from './domain/interfaces/repositories/day-log.repository.interface';
import { DAY_LOG_USE_CASES } from './application/use-cases';
import { ExtraSessionModule } from '../extra-session/extra-session.module';
import { ActiveTrackingModule } from '../active-tracking/active-tracking.module';

@Module({
  imports: [
    forwardRef(() => WorkoutSessionModule),
    forwardRef(() => ActiveTrackingModule),
    RoutineDayModule,
    MongooseModule.forFeature([
      { name: DayLog.name, schema: DayLogSchema },
      { name: WorkoutSession.name, schema: WorkoutSessionSchema },
      { name: RoutinePlan.name, schema: RoutinePlanSchema },
    ]),
    AuditLogsModule,
    ExtraSessionModule,
  ],
  providers: [
    DayLogResolver,
    DayLogService,
    DayLogValidator,
    ...DAY_LOG_USE_CASES,
    {
      provide: DAY_LOG_REPOSITORY,
      useClass: DayLogRepository,
    },
  ],
  exports: [
    DayLogService,
    DAY_LOG_REPOSITORY,
  ],
})
export class DayLogModule {}
