import { ObjectType, Field } from '@nestjs/graphql';
import { UserProfile } from './user-profile.entity';
import { Goal } from './goal.entity';
import { HealthConstraint } from './health-constraint.entity';
import { Schedule } from './schedule.entity';
import { TrainingPreference } from './training-preference.entity';
import { Resource } from './resource.entity';
import { StrengthMetric } from './strength-metric.entity';
import { WeightLog } from './weight-log.entity';

@ObjectType()
export class UserProfileContext {
  @Field(() => UserProfile, { nullable: true })
  profile?: UserProfile;

  @Field(() => Goal, { nullable: true })
  goal?: Goal;

  @Field(() => HealthConstraint, { nullable: true })
  healthConstraints?: HealthConstraint;

  @Field(() => Schedule, { nullable: true })
  schedule?: Schedule;

  @Field(() => TrainingPreference, { nullable: true })
  trainingPreferences?: TrainingPreference;

  @Field(() => Resource, { nullable: true })
  resources?: Resource;

  @Field(() => [StrengthMetric], { nullable: true })
  strengthMetrics?: StrengthMetric[];

  @Field(() => [WeightLog], { nullable: true })
  weightLogs?: WeightLog[];
}
