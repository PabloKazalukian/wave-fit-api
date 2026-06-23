import { Module } from '@nestjs/common';
import { TrainingPlanService } from './training-plan.service';
import { TrainingPlanResolver } from './training-plan.resolver';
import { PlanGeneratorService } from './plan-generator/plan-generator.service';
import { PlanValidatorService } from './plan-validator/plan-validator.service';
import { MongooseModule } from '@nestjs/mongoose';
import { TrainingPlan } from './entities/training-plan.entity';
import { TrainingPlanSchema } from './schema/training-plan.schema';
import { AiService } from '../ai/ai.service';
import { UserProfileModule, UserProfileService } from '../user/user-profile';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    // 1. REGISTRA EL MODELO AQUÍ PARA ESTE MÓDULO
    MongooseModule.forFeature([
      { name: TrainingPlan.name, schema: TrainingPlanSchema },
    ]),

    // 2. Tus otros módulos externos que ya arreglamos
    AiModule,
    UserProfileModule,
  ],
  providers: [
    TrainingPlanService,
    TrainingPlanResolver,
    PlanGeneratorService,
    PlanValidatorService,
    UserProfileService,
    AiService,
  ],
  exports: [TrainingPlanService],
})
export class TrainingPlanModule {}
