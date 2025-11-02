import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { RoutinePlanService } from './routine-plan.service';
import { RoutinePlan } from './entities/routine-plan.entity';
import { CreateRoutinePlanInput } from './dto/create-routine-plan.input';
import { UpdateRoutinePlanInput } from './dto/update-routine-plan.input';

@Resolver(() => RoutinePlan)
export class RoutinePlanResolver {
  constructor(private readonly routinePlanService: RoutinePlanService) {}

  @Mutation(() => RoutinePlan)
  createRoutinePlan(@Args('createRoutinePlanInput') createRoutinePlanInput: CreateRoutinePlanInput) {
    return this.routinePlanService.create(createRoutinePlanInput);
  }

  @Query(() => [RoutinePlan], { name: 'routinePlan' })
  findAll() {
    return this.routinePlanService.findAll();
  }

  @Query(() => RoutinePlan, { name: 'routinePlan' })
  findOne(@Args('id', { type: () => Int }) id: number) {
    return this.routinePlanService.findOne(id);
  }

  @Mutation(() => RoutinePlan)
  updateRoutinePlan(@Args('updateRoutinePlanInput') updateRoutinePlanInput: UpdateRoutinePlanInput) {
    return this.routinePlanService.update(updateRoutinePlanInput.id, updateRoutinePlanInput);
  }

  @Mutation(() => RoutinePlan)
  removeRoutinePlan(@Args('id', { type: () => Int }) id: number) {
    return this.routinePlanService.remove(id);
  }
}
