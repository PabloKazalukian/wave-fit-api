import {
  Resolver,
  Query,
  Mutation,
  Args,
  Int,
  ResolveField,
  Parent,
} from '@nestjs/graphql';
import { RoutinePlanService } from './routine-plan.service';
import { RoutinePlan } from './entities/routine-plan.entity';
import { CreateRoutinePlanInput } from './dto/create-routine-plan.input';
import { UpdateRoutinePlanInput } from './dto/update-routine-plan.input';
import { RoutineDay } from '../routine-day/entities/routine-day.entity';
import { RoutineDayService } from '../routine-day/routine-day.service';

@Resolver(() => RoutinePlan)
export class RoutinePlanResolver {
  constructor(
    private readonly routinePlanService: RoutinePlanService,
    private readonly routineDayService: RoutineDayService,
  ) {}

  @Mutation(() => RoutinePlan)
  createRoutinePlan(
    @Args('createRoutinePlanInput')
    createRoutinePlanInput: CreateRoutinePlanInput,
  ) {
    return this.routinePlanService.create(createRoutinePlanInput);
  }
  
  @ResolveField(() => [RoutineDay], { name: 'routineDays' })
  async resolveRoutineDays(@Parent() plan: RoutinePlan) {
    if (!plan.routineDays?.length) return [];
    return this.routineDayService.findByIds(plan.routineDays);
  }

  @Query(() => [RoutinePlan], { name: 'routinePlans' })
  routines() {
    return this.routinePlanService.findAll();
  }

  @Query(() => RoutinePlan, { name: 'routinePlan' })
  findOne(@Args('id', { type: () => Int }) id: number) {
    return this.routinePlanService.findOne(id);
  }

  @Mutation(() => RoutinePlan)
  updateRoutinePlan(
    @Args('updateRoutinePlanInput')
    updateRoutinePlanInput: UpdateRoutinePlanInput,
  ) {
    return this.routinePlanService.update(
      updateRoutinePlanInput.id,
      updateRoutinePlanInput,
    );
  }

  @Mutation(() => RoutinePlan)
  removeRoutinePlan(@Args('id', { type: () => Int }) id: number) {
    return this.routinePlanService.remove(id);
  }
}
