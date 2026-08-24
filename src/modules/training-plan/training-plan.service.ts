import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateTrainingPlanInput } from './dto/create-training-plan.input';
import { UpdateTrainingPlanInput } from './dto/update-training-plan.input';
import {
  GeneratePlanResult,
  PlanGeneratorService,
} from './plan-generator/plan-generator.service';
import {
  TrainingPlan,
  PlanStatus,
  normalizePlanFocus,
} from './schema/training-plan.schema';

@Injectable()
export class TrainingPlanService {
  /**
   * Lock en memoria por userId+comment: garantiza idempotencia end-to-end
   * (un único documento persistido) ante requests duplicados concurrentes.
   * El lock interno de PlanGeneratorService deduplica la llamada a la IA,
   * pero sin esta capa cada request crearía su propio TrainingPlan.
   */
  private readonly generating = new Map<string, Promise<TrainingPlan>>();

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

  async findAll(userId: string, limit: number = 5, offset: number = 0) {
    const userIdObj = new Types.ObjectId(userId);

    const [plans, total] = await Promise.all([
      this.trainingPlanModel
        .find({ userId: userIdObj })
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .exec(),
      this.trainingPlanModel.countDocuments({ userId: userIdObj }),
    ]);

    plans.forEach((plan) => {
      plan.focus = normalizePlanFocus(plan.focus as string);
    });

    return {
      items: plans,
      total,
      limit,
      offset,
      totalPages: Math.ceil(total / limit),
    };
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
    const key = `${userId}::${comment}`;
    const current = this.generating.get(key);
    if (current) return current;

    const promise = this.doGenerate(userId, comment).finally(() => {
      if (this.generating.get(key) === promise) {
        this.generating.delete(key);
      }
    });
    // Registro sincrónico antes del primer await: cierra la brecha
    // check-then-act entre dos requests que llegan en el mismo tick.
    this.generating.set(key, promise);
    return promise;
  }

  private async doGenerate(
    userId: string,
    comment: string = '',
  ): Promise<TrainingPlan> {
    const result: GeneratePlanResult = await this.generator.generatePlan(
      userId,
      comment,
    );

    const startDate: Date = result.weekLog.startDate;
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
