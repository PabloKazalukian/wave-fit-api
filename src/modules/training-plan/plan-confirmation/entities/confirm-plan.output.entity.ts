import { ObjectType, Field } from '@nestjs/graphql';
import { TrainingPlan as TrainingPlanEntity } from '../../entities/training-plan.entity';
import { WeekLog as WeekLogEntity } from 'src/modules/routines/tracking/week-log/presentation/entities/week-log.entity';
import { RoutinePlan as RoutinePlanEntity } from 'src/modules/routines/templates/routine-plan/entities/routine-plan.entity';

/**
 * Resultado de confirmar un TrainingPlan con una acción.
 *
 * Siempre devuelve el plan actualizado; según la acción elegida llena
 * weekLog (create_week_log) o routinePlan (create_routine_plan).
 */
@ObjectType()
export class ConfirmPlanOutput {
  @Field(() => TrainingPlanEntity)
  trainingPlan: any;

  // WeekLog creado cuando action = create_week_log
  @Field(() => WeekLogEntity, { nullable: true })
  weekLog?: any | null;

  // RoutinePlan creado cuando action = create_routine_plan
  @Field(() => RoutinePlanEntity, { nullable: true })
  routinePlan?: any | null;
}
