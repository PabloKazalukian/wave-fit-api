import { Module } from '@nestjs/common';
import { TrainingPlanService } from './training-plan.service';
import { TrainingPlanResolver } from './training-plan.resolver';
import { UserModule } from '../user/user.module';
import { UserProfileModule } from '../user/user-profile/user-profile.module';
import { PlanGeneratorService } from './plan-generator/plan-generator.service';

@Module({
  providers: [TrainingPlanResolver, TrainingPlanService, PlanGeneratorService],
  imports: [UserModule, UserProfileModule],
})
export class TrainingPlanModule {}
