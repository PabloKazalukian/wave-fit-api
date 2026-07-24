import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { TrainingPlanService } from './training-plan.service';
import { TrainingPlan } from './entities/training-plan.entity';
import { CreateTrainingPlanInput } from './dto/create-training-plan.input';
import { UpdateTrainingPlanInput } from './dto/update-training-plan.input';
import { extractUserId } from 'src/common/utils/user-id.utils';
import { GqlAuthGuard } from 'src/modules/auth/guards/gql-auth.guard';

@Resolver(() => TrainingPlan)
@UseGuards(GqlAuthGuard)
export class TrainingPlanResolver {
  constructor(private readonly trainingPlanService: TrainingPlanService) {}

  @Mutation(() => TrainingPlan)
  createTrainingPlan(
    @Args('createTrainingPlanInput')
    createTrainingPlanInput: CreateTrainingPlanInput,
    @Context() context,
  ) {
    const userId = extractUserId(context);
    return this.trainingPlanService.create(createTrainingPlanInput, userId);
  }

  @Query(() => [TrainingPlan], { name: 'trainingPlans' })
  findAll(@Context() context) {
    const userId = extractUserId(context);
    return this.trainingPlanService.findAll(userId);
  }

  @Query(() => TrainingPlan, { name: 'trainingPlan' })
  findOne(
    @Args('id', { type: () => String }) id: string,
    @Context() context,
  ) {
    const userId = extractUserId(context);
    return this.trainingPlanService.findOne(id, userId);
  }

  @Mutation(() => TrainingPlan)
  updateTrainingPlan(
    @Args('updateTrainingPlanInput')
    updateTrainingPlanInput: UpdateTrainingPlanInput,
    @Context() context,
  ) {
    const userId = extractUserId(context);
    return this.trainingPlanService.update(
      updateTrainingPlanInput.id,
      updateTrainingPlanInput,
      userId,
    );
  }

  @Mutation(() => TrainingPlan)
  removeTrainingPlan(
    @Args('id', { type: () => String }) id: string,
    @Context() context,
  ) {
    const userId = extractUserId(context);
    return this.trainingPlanService.remove(id, userId);
  }

  @Mutation(() => TrainingPlan, { name: 'generatePlan' })
  async generatePlan(@Context() context) {
    const userId = extractUserId(context);
    return this.trainingPlanService.generate(userId);
  }

  @Mutation(() => TrainingPlan, { name: 'confirmPlan' })
  async confirmPlan(
    @Args('id', { type: () => String }) id: string,
    @Context() context,
  ) {
    const userId = extractUserId(context);
    return this.trainingPlanService.confirm(id, userId);
  }
}
