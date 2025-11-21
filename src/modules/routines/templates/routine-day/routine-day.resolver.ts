import {
  Resolver,
  Query,
  Mutation,
  Args,
  Int,
  ResolveField,
  Parent,
} from '@nestjs/graphql';
import { RoutineDayService } from './routine-day.service';
import { RoutineDay } from './entities/routine-day.entity';
import { CreateRoutineDayInput } from './dto/create-routine-day.input';
import {
  findByCategoryInput,
  UpdateRoutineDayInput,
} from './dto/update-routine-day.input';
import { Exercise } from '../exercise/entities/exercise.entity';
import { ExerciseService } from '../exercise/exercise.service';

@Resolver(() => RoutineDay)
export class RoutineDayResolver {
  constructor(
    private readonly routineDayService: RoutineDayService,
    private readonly exerciseService: ExerciseService,
  ) {}

  @Mutation(() => RoutineDay)
  createRoutineDay(
    @Args('createRoutineDayInput') createRoutineDayInput: CreateRoutineDayInput,
  ) {
    return this.routineDayService.create(createRoutineDayInput);
  }

  @Query(() => [RoutineDay], { name: 'routineDays' })
  findAll() {
    return this.routineDayService.findAll();
  }

  @Query(() => RoutineDay, { name: 'routineDay' })
  findOne(@Args('id', { type: () => Int }) id: number) {
    return this.routineDayService.findOne(id);
  }

  @Query(() => [RoutineDay], { name: 'routinesByCategory' })
  routineByCategory(@Args('input') input: findByCategoryInput) {
    return this.routineDayService.findByCategory(input.category);
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

  @ResolveField(() => [Exercise], { nullable: 'itemsAndList' })
  async exercises(@Parent() routineDay: RoutineDay) {
    if (!routineDay.exercises?.length) return [];

    // const ids = routineDay.exercises.map((exercise) => exercise.id);
    const exerciseIds = routineDay.exercises?.map((e: any) =>
      typeof e === 'string' ? e : e._id,
    );

    return await this.exerciseService.findByIds(exerciseIds);
  }

  @Mutation(() => RoutineDay)
  removeRoutineDay(@Args('id', { type: () => Int }) id: number) {
    return this.routineDayService.remove(id);
  }
}
