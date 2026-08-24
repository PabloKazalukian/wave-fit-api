import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ExerciseService } from './exercise.service';
import { Exercise } from './entities/exercise.entity';
import { CreateExerciseInput } from './dto/create-exercise.input';
import { UpdateExerciseInput } from './dto/update-exercise.input';
import { GqlAuthGuard } from 'src/modules/auth/guards/gql-auth.guard';
import { extractUserId } from 'src/modules/user/user-profile/user-profile.utils';

@Resolver(() => Exercise)
export class ExerciseResolver {
  constructor(private readonly exerciseService: ExerciseService) {}

  @Mutation(() => Exercise)
  createExercise(
    @Args('createExerciseInput') createExerciseInput: CreateExerciseInput,
  ) {
    return this.exerciseService.create(createExerciseInput);
  }

  @Query(() => [Exercise], { name: 'exercises' })
  @UseGuards(GqlAuthGuard)
  async exercises(@Context() context) {
    const [exercises, favoriteIds] = await Promise.all([
      this.exerciseService.findAll(),
      this.exerciseService.getFavoriteExerciseIds(extractUserId(context)),
    ]);
    return this.exerciseService.markFavorites(exercises, favoriteIds);
  }

  @Query(() => Exercise, { name: 'exercise', nullable: true })
  @UseGuards(GqlAuthGuard)
  async findOne(
    @Args('id', { type: () => String }) id: string,
    @Context() context,
  ) {
    const exercise = await this.exerciseService.findOne(id);
    if (!exercise) {
      return null;
    }
    const favoriteIds = await this.exerciseService.getFavoriteExerciseIds(
      extractUserId(context),
    );
    return this.exerciseService.markFavorites([exercise], favoriteIds)[0];
  }

  @Mutation(() => Exercise)
  updateExercise(
    @Args('updateExerciseInput') updateExerciseInput: UpdateExerciseInput,
  ) {
    return this.exerciseService.update(
      updateExerciseInput.id,
      updateExerciseInput,
    );
  }

  @Mutation(() => Exercise)
  removeExercise(@Args('id', { type: () => String }) id: string) {
    return this.exerciseService.remove(id);
  }
}
