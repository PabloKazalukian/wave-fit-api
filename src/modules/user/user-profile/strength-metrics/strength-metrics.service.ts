import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserStrengthMetric } from '../schema/strength-metrics.schema';
import { CreateStrengthMetricInput } from './dto/create-strength-metric.input';

@Injectable()
export class StrengthMetricsService {
  constructor(
    @InjectModel(UserStrengthMetric.name)
    private readonly strengthModel: Model<UserStrengthMetric>,
  ) {}

  async createStrengthMetric(
    userId: string,
    input: CreateStrengthMetricInput,
  ): Promise<UserStrengthMetric> {
    const objectId = new Types.ObjectId(userId);
    return this.strengthModel.create({
      ...input,
      userId: objectId,
      measuredAt: input.measuredAt ? new Date(input.measuredAt) : new Date(),
      confidenceLevel: input.confidenceLevel ?? 'self_reported',
    });
  }

  async removeStrengthMetric(
    userId: string,
    metricId: string,
  ): Promise<UserStrengthMetric> {
    const deleted = await this.strengthModel
      .findOneAndDelete({
        _id: new Types.ObjectId(metricId),
        userId: new Types.ObjectId(userId),
      })
      .exec();
    if (!deleted) {
      throw new NotFoundException('Strength metric not found');
    }
    return deleted;
  }

  async findStrengthMetrics(userId: string): Promise<UserStrengthMetric[]> {
    return this.strengthModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ measuredAt: -1 })
      .exec();
  }

  async removeStrengthMetrics(userId: string): Promise<boolean> {
    const result = await this.strengthModel
      .deleteMany({ userId: new Types.ObjectId(userId) })
      .exec();
    return result.deletedCount > 0;
  }
}
