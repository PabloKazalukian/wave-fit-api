import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateTrainingPlanInput } from './dto/create-training-plan.input';
import { UpdateTrainingPlanInput } from './dto/update-training-plan.input';
import { PlanGeneratorService } from './plan-generator/plan-generator.service';
import { TrainingPlan } from './schema/training-plan.schema';

@Injectable()
export class TrainingPlanService {
  constructor(
    @InjectModel(TrainingPlan.name)
    private readonly trainingPlanModel: Model<TrainingPlan>,
    private readonly generator: PlanGeneratorService,
  ) {}

  async create(createTrainingPlanInput: CreateTrainingPlanInput, userId: string) {
    const plan = await this.trainingPlanModel.create({
      userId: new Types.ObjectId(userId),
      title: createTrainingPlanInput.title,
      focus: createTrainingPlanInput.focus,
      startDate: createTrainingPlanInput.startDate
        ? new Date(createTrainingPlanInput.startDate)
        : new Date(),
      endDate: new Date(),
      durationWeeks: createTrainingPlanInput.durationWeeks,
      trainingDaysPerWeek: createTrainingPlanInput.trainingDaysPerWeek,
      tags: createTrainingPlanInput.tags ?? [],
    });
    return plan;
  }

  async findAll(userId: string) {
    return this.trainingPlanModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string, userId: string) {
    const plan = await this.trainingPlanModel
      .findOne({
        _id: new Types.ObjectId(id),
        userId: new Types.ObjectId(userId),
      })
      .exec();
    if (!plan) throw new NotFoundException('Training plan not found');
    return plan;
  }

  async update(id: string, updateTrainingPlanInput: UpdateTrainingPlanInput, userId: string) {
    const plan = await this.trainingPlanModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(id),
          userId: new Types.ObjectId(userId),
        },
        { $set: updateTrainingPlanInput },
        { new: true },
      )
      .exec();
    if (!plan) throw new NotFoundException('Training plan not found');
    return plan;
  }

  async remove(id: string, userId: string) {
    const plan = await this.trainingPlanModel
      .findOneAndDelete({
        _id: new Types.ObjectId(id),
        userId: new Types.ObjectId(userId),
      })
      .exec();
    if (!plan) throw new NotFoundException('Training plan not found');
    return plan;
  }

  async generate(userId: string) {
    const plan = await this.generator.generatePlan(userId);
    return plan;
  }
}
