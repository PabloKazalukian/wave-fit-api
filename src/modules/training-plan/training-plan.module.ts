import { Module } from '@nestjs/common';
import { TrainingPlanService } from './training-plan.service';
import { TrainingPlanResolver } from './training-plan.resolver';
import { PlanGeneratorService } from './plan-generator/plan-generator.service';
import { PlanGeneratorParser } from './plan-generator/plan-generator.parser';
import { PlanValidatorService } from './plan-validator/plan-validator.service';
import { MongooseModule } from '@nestjs/mongoose';
import { TrainingPlan, TrainingPlanSchema } from './schema/training-plan.schema';
import { Goal, GoalSchema } from './schema/goal.schema';
import { UserProfileModule } from '../user/user-profile';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TrainingPlan.name, schema: TrainingPlanSchema },
      { name: Goal.name, schema: GoalSchema },
    ]),
    AiModule,
    UserProfileModule,
  ],
  providers: [
    TrainingPlanService,
    TrainingPlanResolver,
    PlanGeneratorService,
    PlanGeneratorParser,
    PlanValidatorService,
  ],
  exports: [TrainingPlanService],
})
export class TrainingPlanModule {}
