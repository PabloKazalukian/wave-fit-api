import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { TrainingPreferenceService } from './training-preference.service';
import { TrainingPreference } from '../entities/training-preference.entity';
import { UpdateTrainingPreferenceInput } from './dto/update-training-preference.input';
import { GqlAuthGuard } from 'src/modules/auth/guards/gql-auth.guard';
import { extractUserId } from '../user-profile.utils';

@Resolver(() => TrainingPreference)
@UseGuards(GqlAuthGuard)
export class TrainingPreferenceResolver {
  constructor(
    private readonly trainingPreferenceService: TrainingPreferenceService,
  ) {}

  @Mutation(() => TrainingPreference)
  updateUserTrainingPreference(
    @Args('input') input: UpdateTrainingPreferenceInput,
    @Context() context,
  ) {
    return this.trainingPreferenceService.updateTrainingPreference(
      extractUserId(context),
      input,
    );
  }

  @Mutation(() => TrainingPreference)
  toggleFavoriteExercise(
    @Args('exerciseId', { type: () => String }) exerciseId: string,
    @Context() context,
  ) {
    return this.trainingPreferenceService.toggleFavoriteExercise(
      extractUserId(context),
      exerciseId,
    );
  }

  @Mutation(() => TrainingPreference)
  toggleFavoriteRoutine(
    @Args('routineId', { type: () => String }) routineId: string,
    @Context() context,
  ) {
    return this.trainingPreferenceService.toggleFavoriteRoutine(
      extractUserId(context),
      routineId,
    );
  }

  @Mutation(() => TrainingPreference)
  toggleFavoriteRoutineDay(
    @Args('routineDayId', { type: () => String }) routineDayId: string,
    @Context() context,
  ) {
    return this.trainingPreferenceService.toggleFavoriteRoutineDay(
      extractUserId(context),
      routineDayId,
    );
  }

  @Query(() => TrainingPreference, { nullable: true })
  userTrainingPreference(@Context() context) {
    return this.trainingPreferenceService.findTrainingPreference(
      extractUserId(context),
    );
  }
}
