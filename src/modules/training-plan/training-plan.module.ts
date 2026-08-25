import { Module } from '@nestjs/common';
import { TrainingPlanService } from './training-plan.service';
import { TrainingPlanResolver } from './training-plan.resolver';
import { PlanGeneratorService } from './plan-generator/plan-generator.service';
import { PlanGeneratorParser } from './plan-generator/plan-generator.parser';
import { PlanValidatorService } from './plan-validator/plan-validator.service';
import { PlanMaterializerService } from './plan-materializer/plan-materializer.service';
import { ConfirmPlanService } from './plan-confirmation/confirm-plan.service';
import { MongooseModule } from '@nestjs/mongoose';
import { TrainingPlan, TrainingPlanSchema } from './schema/training-plan.schema';
import { Goal, GoalSchema } from './schema/goal.schema';
import { UserProfileModule } from '../user/user-profile';
import { AiModule } from '../ai/ai.module';
import { ExerciseModule } from '../routines/templates/exercise/exercise.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { WeekLogModule } from '../routines/tracking/week-log/week-log.module';
import { WorkoutSessionModule } from '../routines/tracking/workout-session/workout-session.module';
import {
  RoutineDay,
  RoutineDaySchema,
} from '../routines/templates/routine-day/schema/routine-day.schema';
import {
  RoutinePlan,
  RoutinePlanSchema,
} from '../routines/templates/routine-plan/schema/routine-plan.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TrainingPlan.name, schema: TrainingPlanSchema },
      { name: Goal.name, schema: GoalSchema },
      // Modelos necesarios para la confirmación (creación de templates)
      { name: RoutineDay.name, schema: RoutineDaySchema },
      { name: RoutinePlan.name, schema: RoutinePlanSchema },
    ]),
    AiModule,
    UserProfileModule,
    ExerciseModule,
    AuditLogsModule,
    WeekLogModule,
    WorkoutSessionModule,
  ],
  providers: [
    TrainingPlanService,
    TrainingPlanResolver,
    PlanGeneratorService,
    PlanGeneratorParser,
    PlanValidatorService,
    PlanMaterializerService,
    ConfirmPlanService,
  ],
  exports: [TrainingPlanService],
})
export class TrainingPlanModule {}
