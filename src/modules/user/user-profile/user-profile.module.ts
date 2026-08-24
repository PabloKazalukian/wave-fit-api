import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { UserProfile, UserProfileSchema } from './schema/user-profile.schema';
import { UserGoal, UserGoalSchema } from './schema/goals.schema';
import {
  UserStrengthMetric,
  UserStrengthMetricSchema,
} from './schema/strength-metrics.schema';
import { UserSchedule, UserScheduleSchema } from './schema/schedule.schema';
import {
  UserHealthConstraint,
  UserHealthConstraintSchema,
} from './schema/health-constraints.schema';
import {
  UserTrainingPreference,
  UserTrainingPreferenceSchema,
} from './schema/training-preference.schema';
import { UserWeightLog, UserWeightLogSchema } from './schema/weight.schema';
import {
  WorkoutSession,
  WorkoutSessionSchema,
} from 'src/modules/routines/tracking/workout-session/schema/workout-session.schema';
import { ExerciseModule } from 'src/modules/routines/templates/exercise/exercise.module';
import { RoutinePlanModule } from 'src/modules/routines/templates/routine-plan/routine-plan.module';
import { UserResource, UserResourceSchema } from './schema/resourse.schema';
import { UserProfileResolver } from './user-profile.resolver';
import { UserProfileService } from './user-profile.service';
import { GoalsResolver } from './goals/goals.resolver';
import { GoalsService } from './goals/goals.service';
import { TrainingPreferenceResolver } from './training-preference/training-preference.resolver';
import { TrainingPreferenceService } from './training-preference/training-preference.service';
import { WeightResolver } from './weight/weight.resolver';
import { WeightService } from './weight/weight.service';
import { HealthConstraintsResolver } from './health-constraints/health-constraints.resolver';
import { HealthConstraintsService } from './health-constraints/health-constraints.service';
import { ScheduleResolver } from './schedule/schedule.resolver';
import { ScheduleService } from './schedule/schedule.service';
import { ResourceResolver } from './resource/resource.resolver';
import { ResourceService } from './resource/resource.service';
import { StrengthMetricsResolver } from './strength-metrics/strength-metrics.resolver';
import { StrengthMetricsService } from './strength-metrics/strength-metrics.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserProfile.name, schema: UserProfileSchema },
      { name: UserGoal.name, schema: UserGoalSchema },
      { name: UserStrengthMetric.name, schema: UserStrengthMetricSchema },
      { name: UserResource.name, schema: UserResourceSchema },
      { name: UserSchedule.name, schema: UserScheduleSchema },
      { name: UserHealthConstraint.name, schema: UserHealthConstraintSchema },
      {
        name: UserTrainingPreference.name,
        schema: UserTrainingPreferenceSchema,
      },
      { name: WorkoutSession.name, schema: WorkoutSessionSchema },
      { name: UserWeightLog.name, schema: UserWeightLogSchema },
    ]),
    ExerciseModule,
    RoutinePlanModule,
  ],
  providers: [
    UserProfileResolver,
    UserProfileService,
    GoalsResolver,
    GoalsService,
    TrainingPreferenceResolver,
    TrainingPreferenceService,
    WeightResolver,
    WeightService,
    HealthConstraintsResolver,
    HealthConstraintsService,
    ScheduleResolver,
    ScheduleService,
    ResourceResolver,
    ResourceService,
    StrengthMetricsResolver,
    StrengthMetricsService,
  ],

  exports: [MongooseModule, UserProfileService],
})
export class UserProfileModule {}
