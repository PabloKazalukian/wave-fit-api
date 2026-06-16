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
import { UserResource, UserResourceSchema } from './schema/resourse.schema';
import { UserProfileResolver } from './user-profile.resolver';
import { UserProfileService } from './user-profile.service';

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
  ],
  providers: [UserProfileResolver, UserProfileService],

  exports: [MongooseModule],
})
export class UserProfileModule {}
