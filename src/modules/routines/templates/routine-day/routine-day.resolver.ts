import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { RoutineDayService } from './routine-day.service';
import { RoutineDay } from './entities/routine-day.entity';
import { CreateRoutineDayInput } from './dto/create-routine-day.input';
import {
  findByCategoryInput,
  UpdateRoutineDayInput,
} from './dto/update-routine-day.input';

@Resolver(() => RoutineDay)
export class RoutineDayResolver {
  constructor(private readonly routineDayService: RoutineDayService) {}

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
  findOne(@Args('id', { type: () => String }) id: String) {
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

  @Mutation(() => RoutineDay)
  removeRoutineDay(@Args('id', { type: () => Int }) id: number) {
    return this.routineDayService.remove(id);
  }
}
