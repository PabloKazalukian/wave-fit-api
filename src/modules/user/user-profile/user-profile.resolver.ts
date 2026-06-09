import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { UserProfileService } from './user-profile.service';
import { UserProfile } from './entities/user-profile.entity';
import { Goal } from './entities/goal.entity';
import { HealthConstraint } from './entities/health-constraint.entity';
import { Schedule } from './entities/schedule.entity';
import { TrainingPreference } from './entities/training-preference.entity';
import { Resource } from './entities/resource.entity';
import { StrengthMetric } from './entities/strength-metric.entity';
import { WeightLog } from './entities/weight-log.entity';
import { CreateUserProfileInput } from './dto/create-user-profile.input';
import { UpdateUserProfileInput } from './dto/update-user-profile.input';
import { UpdateGoalsInput } from './dto/update-goals.input';
import { UpdateHealthConstraintsInput } from './dto/update-health-constraints.input';
import { UpdateScheduleInput } from './dto/update-schedule.input';
import { UpdateTrainingPreferenceInput } from './dto/update-training-preference.input';
import { UpdateResourceInput } from './dto/update-resource.input';
import { CreateStrengthMetricInput } from './dto/create-strength-metric.input';
import { CreateWeightLogInput } from './dto/create-weight-log.input';
import { GqlAuthGuard } from 'src/modules/auth/guards/gql-auth.guard';

function extractUserId(context: any): string {
  const userId = context?.req?.user?.id;
  if (!userId || !Types.ObjectId.isValid(userId)) {
    throw new BadRequestException('Invalid user id');
  }
  return userId;
}

@Resolver()
@UseGuards(GqlAuthGuard)
export class UserProfileResolver {
  constructor(private readonly userProfileService: UserProfileService) {}

  // ── Base Profile ──

  @Mutation(() => UserProfile)
  createUserProfile(
    @Args('createUserProfileInput') input: CreateUserProfileInput,
    @Context() context,
  ) {
    return this.userProfileService.create(input, extractUserId(context));
  }

  @Query(() => [UserProfile], { name: 'userProfiles' })
  findAll() {
    return this.userProfileService.findAll();
  }

  @Query(() => UserProfile, { name: 'userProfile', nullable: true })
  findOne(
    @Args('id', { type: () => String }) id: string,
    @Context() context,
  ) {
    return this.userProfileService.findOne(id, extractUserId(context));
  }

  @Query(() => UserProfile, { name: 'myProfile', nullable: true })
  myProfile(@Context() context) {
    return this.userProfileService.findByUserId(extractUserId(context));
  }

  @Mutation(() => UserProfile)
  updateUserProfile(
    @Args('updateUserProfileInput') input: UpdateUserProfileInput,
    @Context() context,
  ) {
    const userId = extractUserId(context);
    const id = input.id;
    if (!id || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid profile id');
    }
    return this.userProfileService.update(id, input, userId);
  }

  @Mutation(() => UserProfile)
  upsertUserProfile(
    @Args('createUserProfileInput') input: CreateUserProfileInput,
    @Context() context,
  ) {
    return this.userProfileService.upsert(input, extractUserId(context));
  }

  @Mutation(() => UserProfile)
  removeUserProfile(
    @Args('id', { type: () => String }) id: string,
    @Context() context,
  ) {
    return this.userProfileService.remove(id, extractUserId(context));
  }

  // ── Goals ──

  @Mutation(() => Goal)
  updateUserGoals(
    @Args('input') input: UpdateGoalsInput,
    @Context() context,
  ) {
    return this.userProfileService.updateGoals(extractUserId(context), input);
  }

  @Query(() => Goal, { nullable: true })
  userGoals(@Context() context) {
    return this.userProfileService.findGoals(extractUserId(context));
  }

  // ── Health Constraints ──

  @Mutation(() => HealthConstraint)
  updateUserHealthConstraints(
    @Args('input') input: UpdateHealthConstraintsInput,
    @Context() context,
  ) {
    return this.userProfileService.updateHealthConstraints(
      extractUserId(context),
      input,
    );
  }

  @Query(() => HealthConstraint, { nullable: true })
  userHealthConstraints(@Context() context) {
    return this.userProfileService.findHealthConstraints(
      extractUserId(context),
    );
  }

  // ── Schedule ──

  @Mutation(() => Schedule)
  updateUserSchedule(
    @Args('input') input: UpdateScheduleInput,
    @Context() context,
  ) {
    return this.userProfileService.updateSchedule(
      extractUserId(context),
      input,
    );
  }

  @Query(() => Schedule, { nullable: true })
  userSchedule(@Context() context) {
    return this.userProfileService.findSchedule(extractUserId(context));
  }

  // ── Training Preference ──

  @Mutation(() => TrainingPreference)
  updateUserTrainingPreference(
    @Args('input') input: UpdateTrainingPreferenceInput,
    @Context() context,
  ) {
    return this.userProfileService.updateTrainingPreference(
      extractUserId(context),
      input,
    );
  }

  @Query(() => TrainingPreference, { nullable: true })
  userTrainingPreference(@Context() context) {
    return this.userProfileService.findTrainingPreference(
      extractUserId(context),
    );
  }

  // ── Resource ──

  @Mutation(() => Resource)
  updateUserResource(
    @Args('input') input: UpdateResourceInput,
    @Context() context,
  ) {
    return this.userProfileService.updateResource(
      extractUserId(context),
      input,
    );
  }

  @Query(() => Resource, { nullable: true })
  userResource(@Context() context) {
    return this.userProfileService.findResource(extractUserId(context));
  }

  // ── Strength Metrics (colección) ──

  @Mutation(() => StrengthMetric)
  createUserStrengthMetric(
    @Args('input') input: CreateStrengthMetricInput,
    @Context() context,
  ) {
    return this.userProfileService.createStrengthMetric(
      extractUserId(context),
      input,
    );
  }

  @Mutation(() => StrengthMetric)
  removeUserStrengthMetric(
    @Args('id', { type: () => String }) id: string,
    @Context() context,
  ) {
    return this.userProfileService.removeStrengthMetric(
      extractUserId(context),
      id,
    );
  }

  @Query(() => [StrengthMetric])
  userStrengthMetrics(@Context() context) {
    return this.userProfileService.findStrengthMetrics(
      extractUserId(context),
    );
  }

  // ── Weight Logs (colección) ──

  @Mutation(() => WeightLog)
  createWeightLog(
    @Args('input') input: CreateWeightLogInput,
    @Context() context,
  ) {
    return this.userProfileService.createWeightLog(
      extractUserId(context),
      input,
    );
  }

  @Query(() => [WeightLog])
  userWeightLogs(@Context() context) {
    return this.userProfileService.findWeightLogs(extractUserId(context));
  }
}
