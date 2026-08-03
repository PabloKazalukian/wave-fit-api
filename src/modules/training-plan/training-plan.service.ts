import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateTrainingPlanInput } from './dto/create-training-plan.input';
import { UpdateTrainingPlanInput } from './dto/update-training-plan.input';
import { PlanGeneratorService } from './plan-generator/plan-generator.service';
import {
  TrainingPlan,
  PlanStatus,
  normalizePlanFocus,
} from './schema/training-plan.schema';

@Injectable()
export class TrainingPlanService {
  constructor(
    @InjectModel(TrainingPlan.name)
    private readonly trainingPlanModel: Model<TrainingPlan>,
    private readonly generator: PlanGeneratorService,
  ) {}

  async create(
    createTrainingPlanInput: CreateTrainingPlanInput,
    userId: string,
  ) {
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
    plan.focus = normalizePlanFocus(plan.focus as string);
    return plan;
  }

  async findAll(userId: string) {
    const plans = await this.trainingPlanModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
    plans.forEach((plan) => {
      plan.focus = normalizePlanFocus(plan.focus as string);
    });
    return plans;
  }

  async findOne(id: string, userId: string) {
    const plan = await this.trainingPlanModel
      .findOne({
        _id: id,
        userId: new Types.ObjectId(userId),
      })
      .exec();
    if (!plan) throw new NotFoundException('Training plan not found');
    plan.focus = normalizePlanFocus(plan.focus as string);
    return plan;
  }

  async update(
    id: string,
    updateTrainingPlanInput: UpdateTrainingPlanInput,
    userId: string,
  ) {
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
    plan.focus = normalizePlanFocus(plan.focus as string);
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

  async generate(userId: string, comment: string = '') {
    const result = await this.generator.generatePlan(userId, comment);

    const startDate = result.weekLog.startDate;
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + result.metadata.durationWeeks * 7);

    const plan = await this.trainingPlanModel.create({
      userId: new Types.ObjectId(userId),
      userProfileId: new Types.ObjectId(result.userProfileId),
      goalId: new Types.ObjectId(result.goalId),
      title: result.metadata.title,
      focus: result.metadata.focus,
      status: PlanStatus.DRAFT,
      startDate,
      endDate,
      durationWeeks: result.metadata.durationWeeks,
      trainingDaysPerWeek: result.metadata.daysPerWeek,
      aiSnapshot: result.aiSnapshot,
      confirmed: false,
    });

    plan.focus = normalizePlanFocus(plan.focus as string);
    return plan;
  }

  async confirm(id: string, userId: string) {
    const plan = await this.trainingPlanModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) },
        { $set: { confirmed: true } },
        { new: true },
      )
      .exec();
    if (!plan) throw new NotFoundException('Training plan not found');
    plan.focus = normalizePlanFocus(plan.focus as string);
    return plan;
  }
}
