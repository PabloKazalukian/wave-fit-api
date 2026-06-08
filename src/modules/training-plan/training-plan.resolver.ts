import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { TrainingPlanService } from './training-plan.service';
import { TrainingPlan } from './entities/training-plan.entity';
import { CreateTrainingPlanInput } from './dto/create-training-plan.input';
import { UpdateTrainingPlanInput } from './dto/update-training-plan.input';

@Resolver(() => TrainingPlan)
export class TrainingPlanResolver {
  constructor(private readonly trainingPlanService: TrainingPlanService) {}

  @Mutation(() => TrainingPlan)
  createTrainingPlan(@Args('createTrainingPlanInput') createTrainingPlanInput: CreateTrainingPlanInput) {
    return this.trainingPlanService.create(createTrainingPlanInput);
  }

  @Query(() => [TrainingPlan], { name: 'trainingPlan' })
  findAll() {
    return this.trainingPlanService.findAll();
  }

  @Query(() => TrainingPlan, { name: 'trainingPlan' })
  findOne(@Args('id', { type: () => Int }) id: number) {
    return this.trainingPlanService.findOne(id);
  }

  @Mutation(() => TrainingPlan)
  updateTrainingPlan(@Args('updateTrainingPlanInput') updateTrainingPlanInput: UpdateTrainingPlanInput) {
    return this.trainingPlanService.update(updateTrainingPlanInput.id, updateTrainingPlanInput);
  }

  @Mutation(() => TrainingPlan)
  removeTrainingPlan(@Args('id', { type: () => Int }) id: number) {
    return this.trainingPlanService.remove(id);
  }
}
