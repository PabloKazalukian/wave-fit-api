import {
  Resolver,
  Query,
  Mutation,
  Args,
  Parent,
  ResolveField,
  ID,
  Context,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { RoutineDayService } from './routine-day.service';
import { RoutineDay, RoutineDayExercise } from './entities/routine-day.entity';
import { CreateRoutineDayInput } from './dto/create-routine-day.input';
import {
  findByCategoryInput,
  UpdateRoutineDayInput,
} from './dto/update-routine-day.input';
import { Audit } from 'src/modules/audit-logs/audit-logs.decorator';
import { GqlAuthGuard } from 'src/modules/auth/guards/gql-auth.guard';
import { extractUserId } from 'src/modules/user/user-profile/user-profile.utils';

@Resolver(() => RoutineDay)
export class RoutineDayResolver {
  constructor(private readonly routineDayService: RoutineDayService) {}

  @ResolveField(() => ID, { name: 'id' })
  id(@Parent() routineDay: RoutineDay) {
    return routineDay.id;
  }
  @Mutation(() => RoutineDay)
  createRoutineDay(
    @Args('createRoutineDayInput') createRoutineDayInput: CreateRoutineDayInput,
  ) {
    return this.routineDayService.create(createRoutineDayInput);
  }

  @Query(() => [RoutineDay], { name: 'routineDays' })
  @UseGuards(GqlAuthGuard)
  async findAll(@Context() context) {
    const [days, favoriteIds] = await Promise.all([
      this.routineDayService.findAll(),
      this.routineDayService.getFavoriteRoutineDayIds(extractUserId(context)),
    ]);
    return this.routineDayService.markFavorites(days, favoriteIds);
  }

  @Query(() => RoutineDay, { name: 'routineDay', nullable: true })
  @Audit('FINDBY_ID_ROUTINE_DAY', 'routineDay' + 'id')
  @UseGuards(GqlAuthGuard)
  async findOne(
    @Args('id', { type: () => String }) id: string,
    @Context() context,
  ) {
    const day = await this.routineDayService.findOne(id);
    if (!day) return null;
    const favoriteIds = await this.routineDayService.getFavoriteRoutineDayIds(
      extractUserId(context),
    );
    return this.routineDayService.markFavorites([day], favoriteIds)[0];
  }

  @Query(() => [RoutineDay], { name: 'routinesByCategory' })
  @UseGuards(GqlAuthGuard)
  async routineByCategory(
    @Args('input') input: findByCategoryInput,
    @Context() context,
  ) {
    const [days, favoriteIds] = await Promise.all([
      this.routineDayService.findByCategory(input.category),
      this.routineDayService.getFavoriteRoutineDayIds(extractUserId(context)),
    ]);
    return this.routineDayService.markFavorites(days, favoriteIds);
  }

  @Mutation(() => RoutineDay)
  updateRoutineDay(
    @Args('updateRoutineDayInput') updateRoutineDayInput: UpdateRoutineDayInput,
  ) {
    return this.routineDayService.update(
      updateRoutineDayInput.id,
      updateRoutineDayInput,
    );
  }

  @ResolveField(() => [RoutineDayExercise], { nullable: 'itemsAndList' })
  exercises(@Parent() routineDay: RoutineDay) {
    return routineDay.exercises || [];
  }

  @Mutation(() => RoutineDay)
  removeRoutineDay(@Args('id', { type: () => String }) id: string) {
    return this.routineDayService.remove(id);
  }

  @Mutation(() => RoutineDay)
  createRoutineByWorkout(
    @Args('title') title: string,
    @Args('exerciseIds', { type: () => [String] }) exerciseIds: string[],
  ) {
    return this.routineDayService.createFromWorkout(title, exerciseIds);
  }
}
