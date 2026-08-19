import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StatsService } from './stats.service';
import { StatsResolver } from './stats.resolver';
import { StatsEventPublisher } from './stats-event-publisher';
import { UserTopExercise, UserTopExerciseSchema } from './infrastructure/schemas/user-top-exercise.schema';
import { UserTopRoutine, UserTopRoutineSchema } from './infrastructure/schemas/user-top-routine.schema';
import { UserPersonalRecord, UserPersonalRecordSchema } from './infrastructure/schemas/user-personal-record.schema';
import { UserAdherence, UserAdherenceSchema } from './infrastructure/schemas/user-adherence.schema';
import { WorkoutSession, WorkoutSessionSchema } from './infrastructure/schemas/workout-session-reference.schema';
import { WeekLog, WeekLogSchema } from './infrastructure/schemas/week-log-reference.schema';
import { Exercise, ExerciseSchema } from './infrastructure/schemas/exercise-reference.schema';
import { RoutinePlan, RoutinePlanSchema } from './infrastructure/schemas/routine-plan-reference.schema';
import { UserStrengthMetric, UserStrengthMetricSchema } from './infrastructure/schemas/strength-metric-reference.schema';
import { StatsRepository } from './infrastructure/repositories/stats.repository';
import { STATS_REPOSITORY } from './domain/interfaces/repositories/stats.repository.interface';
import { STAT_USE_CASES } from './application/use-cases';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserTopExercise.name, schema: UserTopExerciseSchema },
      { name: UserTopRoutine.name, schema: UserTopRoutineSchema },
      { name: UserPersonalRecord.name, schema: UserPersonalRecordSchema },
      { name: UserAdherence.name, schema: UserAdherenceSchema },
      { name: WorkoutSession.name, schema: WorkoutSessionSchema },
      { name: WeekLog.name, schema: WeekLogSchema },
      { name: Exercise.name, schema: ExerciseSchema },
      { name: RoutinePlan.name, schema: RoutinePlanSchema },
      { name: UserStrengthMetric.name, schema: UserStrengthMetricSchema },
    ]),
  ],
  providers: [
    StatsResolver,
    StatsService,
    StatsEventPublisher,
    ...STAT_USE_CASES,
    {
      provide: STATS_REPOSITORY,
      useClass: StatsRepository,
    },
  ],
  exports: [StatsService],
})
export class StatsModule {}
