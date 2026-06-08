import { Injectable } from '@nestjs/common';
import { CreateTrainingPlanInput } from './dto/create-training-plan.input';
import { UpdateTrainingPlanInput } from './dto/update-training-plan.input';

@Injectable()
export class TrainingPlanService {
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
}
