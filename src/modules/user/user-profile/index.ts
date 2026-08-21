export { UserProfileModule } from './user-profile.module';
export { UserProfileService } from './user-profile.service';
export { UserProfileResolver } from './user-profile.resolver';
export { GoalsService } from './goals/goals.service';
export { GoalsResolver } from './goals/goals.resolver';
export { TrainingPreferenceService } from './training-preference/training-preference.service';
export { TrainingPreferenceResolver } from './training-preference/training-preference.resolver';
export { WeightService } from './weight/weight.service';
export { WeightResolver } from './weight/weight.resolver';

// Entities
export { UserProfileContext } from './entities/user-profile-context.entity';
export { UserProfile } from './entities/user-profile.entity';
export { Goal } from './entities/goal.entity';
export { HealthConstraint } from './entities/health-constraint.entity';
export { Schedule } from './entities/schedule.entity';
export { TrainingPreference } from './entities/training-preference.entity';
export { Resource } from './entities/resource.entity';
export { StrengthMetric } from './entities/strength-metric.entity';
export { WeightLog } from './entities/weight-log.entity';

// DTOs
export { CreateUserProfileInput } from './dto/create-user-profile.input';
export { UpdateUserProfileInput } from './dto/update-user-profile.input';
export { UpdateGoalsInput } from './goals/dto/update-goals.input';
export { UpdateHealthConstraintsInput } from './dto/update-health-constraints.input';
export { UpdateScheduleInput } from './dto/update-schedule.input';
export { UpdateTrainingPreferenceInput } from './training-preference/dto/update-training-preference.input';
export { UpdateResourceInput } from './dto/update-resource.input';
export { CreateStrengthMetricInput } from './dto/create-strength-metric.input';
export { CreateWeightLogInput } from './weight/dto/create-weight-log.input';

// Schemas (para MongooseModule.forFeature)
export { UserProfile as UserProfileSchema } from './schema/user-profile.schema';
export { UserGoal } from './schema/goals.schema';
export { UserStrengthMetric } from './schema/strength-metrics.schema';
export { UserResource } from './schema/resourse.schema';
export { UserSchedule } from './schema/schedule.schema';
export { UserHealthConstraint } from './schema/health-constraints.schema';
export { UserTrainingPreference } from './schema/training-preference.schema';
export { UserWeightLog } from './schema/weight.schema';
