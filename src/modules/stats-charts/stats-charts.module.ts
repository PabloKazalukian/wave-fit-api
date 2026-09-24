import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkoutSessionSchema } from '../routines/tracking/workout-session/schema/workout-session.schema';
import { WeekLogSchema } from '../routines/tracking/week-log/infrastructure/schemas/week-log.schema';
import { DayLogSchema } from '../routines/tracking/day-log/infrastructure/schemas/day-log.schema';
import { ExtraSessionSchema } from '../routines/tracking/extra-session/schema/extra-session.schema';
import { ExerciseSchema } from '../routines/templates/exercise/schema/exercise.schema';
import { UserWeightLogSchema } from '../user/user-profile/schema/weight.schema';
import { RoutinePlanSchema } from '../routines/templates/routine-plan/schema/routine-plan.schema';
import { RoutineDaySchema } from '../routines/templates/routine-day/schema/routine-day.schema';
import { UserProfileSchema } from '../user/user-profile/schema/user-profile.schema';
import { OneRmWeeklyCalculator } from './calculators/one-rm-weekly.calculator';
import { VolumeWeeklyCalculator } from './calculators/volume-weekly.calculator';
import { VolumeTotalWeeklyCalculator } from './calculators/volume-total.calculator';
import { CaloriesCalculator } from './calculators/calories.calculator';
import { ForgottenMusclesCalculator } from './calculators/forgotten-muscles.calculator';
import { TrendCalculator } from './calculators/trend.calculator';
import { StatsChartsService } from './stats-charts.service';
import { StatsChartsResolver } from './stats-charts.resolver';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: 'StatsChartsWorkoutSession',
        schema: WorkoutSessionSchema,
        collection: 'workoutsessions',
      },
      {
        name: 'StatsChartsWeekLog',
        schema: WeekLogSchema,
        collection: 'weeklogs',
      },
      {
        name: 'StatsChartsDayLog',
        schema: DayLogSchema,
        collection: 'daylogs',
      },
      {
        name: 'StatsChartsExtraSession',
        schema: ExtraSessionSchema,
        collection: 'extrasessions',
      },
      {
        name: 'StatsChartsExercise',
        schema: ExerciseSchema,
        collection: 'exercises',
      },
      {
        name: 'StatsChartsUserWeightLog',
        schema: UserWeightLogSchema,
        collection: 'userweightlogs',
      },
      {
        name: 'StatsChartsRoutinePlan',
        schema: RoutinePlanSchema,
        collection: 'routineplans',
      },
      {
        name: 'StatsChartsRoutineDay',
        schema: RoutineDaySchema,
        collection: 'routinedays',
      },
      {
        name: 'StatsChartsUserProfile',
        schema: UserProfileSchema,
        collection: 'userprofiles',
      },
    ]),
  ],
  providers: [
    OneRmWeeklyCalculator,
    VolumeWeeklyCalculator,
    VolumeTotalWeeklyCalculator,
    CaloriesCalculator,
    ForgottenMusclesCalculator,
    TrendCalculator,
    StatsChartsService,
    StatsChartsResolver,
  ],
  exports: [StatsChartsService],
})
export class StatsChartsModule {}