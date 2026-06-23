import { Injectable } from '@nestjs/common';
import { CreateTrainingPlanInput } from './dto/create-training-plan.input';
import { UpdateTrainingPlanInput } from './dto/update-training-plan.input';
import { PlanGeneratorService } from './plan-generator/plan-generator.service';

@Injectable()
export class TrainingPlanService {
  constructor(private readonly generator: PlanGeneratorService) {}
  create(createTrainingPlanInput: CreateTrainingPlanInput) {
    return 'This action adds a new trainingPlan';
  }

  findAll() {
    return `This action returns all trainingPlan`;
  }

  findOne(id: number) {
    return `This action returns a #${id} trainingPlan`;
  }

  update(id: number, updateTrainingPlanInput: UpdateTrainingPlanInput) {
    return `This action updates a #${id} trainingPlan`;
  }

  remove(id: number) {
    return `This action removes a #${id} trainingPlan`;
  }
  async generate(userId: string, goalId: string) {
    const plan = await this.generator.generatePlan(userId, goalId);

    return plan;
  }
}
