import { Module } from '@nestjs/common';
import { WorkoutSessionService } from './workout-session.service';
import { WorkoutSessionResolver } from './workout-session.resolver';
import {
  WorkoutSession,
  WorkoutSessionSchema,
} from './schema/workout-session.schema';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ExercisePerformance,
  ExercisePerformanceSchema,
} from './schema/exercise-performance.schema';
import { WeekLogModule } from '../week-log/week-log.module';
import { AuditLogsModule } from 'src/modules/audit-logs/audit-logs.module';
import { WorkoutSessionValidator } from './workout-session.validator';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WorkoutSession.name, schema: WorkoutSessionSchema },
      { name: ExercisePerformance.name, schema: ExercisePerformanceSchema },
    ]),
    WeekLogModule,
    AuditLogsModule,
  ],
  providers: [
    WorkoutSessionResolver,
    WorkoutSessionService,
    WorkoutSessionValidator,
  ],
})
export class WorkoutSessionModule {}
