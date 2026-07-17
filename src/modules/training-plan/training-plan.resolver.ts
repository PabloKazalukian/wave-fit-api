import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { TrainingPlanService } from './training-plan.service';
import { TrainingPlan } from './entities/training-plan.entity';
import { WeekLog } from '../routines/tracking/week-log/presentation/entities/week-log.entity';
import { CreateTrainingPlanInput } from './dto/create-training-plan.input';
import { UpdateTrainingPlanInput } from './dto/update-training-plan.input';
import { extractUserId } from 'src/common/utils/user-id.utils';
import { GqlAuthGuard } from 'src/modules/auth/guards/gql-auth.guard';
import { GeneratePlanResult } from './plan-generator/plan-generator.service';

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

  @Mutation(() => WeekLog, { name: 'generatePlan' })
  async generatePlan(@Context() context): Promise<WeekLog> {
    const userId = extractUserId(context);
    const result = await this.trainingPlanService.generate(userId);
    return this.mapToWeekLog(result);
  }

  private mapToWeekLog(result: GeneratePlanResult): WeekLog {
    const { weekLog } = result;
    return {
      id: weekLog.id,
      userId: weekLog.userId,
      startDate: weekLog.startDate,
      endDate: weekLog.endDate,
      planId: weekLog.planId,
      completed: weekLog.completed,
      active: weekLog.active,
      days: weekLog.days.map((day) => ({
        order: day.order,
        date: day.date,
        isRest: day.isRest,
        workoutSessionId: day.workoutSessionId,
        exercises: day.exercises || [],
        extraSessionIds: day.extraSessionIds,
        status: day.status,
      })),
    };
  }
}
