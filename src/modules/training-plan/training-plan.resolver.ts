import { Resolver, Query, Mutation, Args, Context, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { TrainingPlanService } from './training-plan.service';
import {
  TrainingPlan,
  TrainingPlanPage,
} from './entities/training-plan.entity';
import { PlanConfirmationAction } from './schema/training-plan.schema';
import { ConfirmPlanOutput } from './plan-confirmation/entities/confirm-plan.output.entity';
import { ConfirmPlanService } from './plan-confirmation/confirm-plan.service';
import { UpdateTrainingPlanInput } from './dto/update-training-plan.input';
import { extractUserId } from 'src/common/utils/user-id.utils';
import { GqlAuthGuard } from 'src/modules/auth/guards/gql-auth.guard';

@Resolver(() => TrainingPlan)
@UseGuards(GqlAuthGuard)
export class TrainingPlanResolver {
  constructor(
    private readonly trainingPlanService: TrainingPlanService,
    private readonly confirmPlanService: ConfirmPlanService,
  ) {}

  @Query(() => TrainingPlanPage, { name: 'trainingPlans' })
  findAll(
    @Context() context,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 5 })
    limit: number,
    @Args('offset', { type: () => Int, nullable: true, defaultValue: 0 })
    offset: number,
  ) {
    const userId = extractUserId(context);
    return this.trainingPlanService.findAll(userId, limit, offset);
  }

  @Query(() => TrainingPlan, { name: 'trainingPlan' })
  findOne(@Args('id', { type: () => String }) id: string, @Context() context) {
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
  async generatePlan(
    @Args('comment', { type: () => String, nullable: true, defaultValue: '' })
    comment: string,
    @Context() context,
  ) {
    const userId = extractUserId(context);
    return this.trainingPlanService.generate(userId, comment);
  }

  /**
   * Modifica un plan vigente (no confirmado) a partir de un comentario del usuario.
   * Reenvía a la IA el plan actual + el comentario y sobrescribe el mismo documento
   * (version + 1).
   */
  @Mutation(() => TrainingPlan, { name: 'modifyPlan' })
  async modifyPlan(
    @Args('id', { type: () => String }) id: string,
    @Args('comment', { type: () => String }) comment: string,
    @Context() context,
  ) {
    const userId = extractUserId(context);
    return this.trainingPlanService.modify(userId, id, comment);
  }

  /**
   * Confirma un plan generado con IA ejecutando la acción elegida:
   * - CREATE_WEEK_LOG → crea la semana de tracking (solo si no hay semana activa)
   * - CREATE_ROUTINE_PLAN → crea el template RoutinePlan (sin pesos)
   * - ADAPT_ACTIVE_WEEK → reservado
   */
  @Mutation(() => ConfirmPlanOutput, { name: 'confirmPlan' })
  async confirmPlan(
    @Args('id', { type: () => String }) id: string,
    @Args('action', { type: () => PlanConfirmationAction })
    action: PlanConfirmationAction,
    @Context() context,
  ) {
    const userId = extractUserId(context);
    return this.confirmPlanService.confirm(userId, id, action);
  }
}
