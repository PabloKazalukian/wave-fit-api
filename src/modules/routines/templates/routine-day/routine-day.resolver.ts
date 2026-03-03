import {
  Resolver,
  Query,
  Mutation,
  Args,
  Int,
  Parent,
  ResolveField,
  ID,
} from '@nestjs/graphql';
import { RoutineDayService } from './routine-day.service';
import { RoutineDay, RoutineDayExercise } from './entities/routine-day.entity';
import { CreateRoutineDayInput } from './dto/create-routine-day.input';
import {
  findByCategoryInput,
  UpdateRoutineDayInput,
} from './dto/update-routine-day.input';
import { Exercise } from '../exercise/entities/exercise.entity';
import { ExerciseService } from '../exercise/exercise.service';
import { Audit } from 'src/modules/audit-logs/audit-logs.decorator';

@Resolver(() => RoutineDay)
export class RoutineDayResolver {
  constructor(
    private readonly routineDayService: RoutineDayService,
    private readonly exerciseService: ExerciseService,
  ) {}

  @ResolveField(() => ID, { name: 'id' })
  id(@Parent() routineDay: any | RoutineDay) {
    return routineDay._id.toString();
  }
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
  @Audit('FINDBY_ID_ROUTINE_DAY', 'routineDay' + 'id')
  findOne(@Args('id', { type: () => String }) id: string) {
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

  @ResolveField(() => [RoutineDayExercise], { nullable: 'itemsAndList' })
  exercises(@Parent() routineDay: any) {
    if (!routineDay.exercises?.length) return [];

    // Devolvemos el array con el objeto 'exercise' extraído correctamente más el 'order'
    return routineDay.exercises.map((e: any) => {
      return {
        exercise:
          typeof e.exercise === 'object' ? e.exercise : { id: e.exercise },
        order: e.order,
      };
    });
  }

  @Mutation(() => RoutineDay)
  removeRoutineDay(@Args('id', { type: () => Int }) id: number) {
    return this.routineDayService.remove(id);
  }
}
