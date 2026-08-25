import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserWeightLog } from '../schema/weight.schema';
import { CreateWeightLogInput } from './dto/create-weight-log.input';

@Injectable()
export class WeightService {
  constructor(
    @InjectModel(UserWeightLog.name)
    private readonly weightLogModel: Model<UserWeightLog>,
  ) {}

  async createWeightLog(
    userId: string,
    input: CreateWeightLogInput,
  ): Promise<UserWeightLog> {
    const objectId = new Types.ObjectId(userId);
    return this.weightLogModel.create({
      ...input,
      userId: objectId,
      loggedAt: input.loggedAt ? new Date(input.loggedAt) : new Date(),
    });
  }

  async findWeightLogs(userId: string): Promise<UserWeightLog[]> {
    return this.weightLogModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ loggedAt: -1 })
      .exec();
  }

  async removeWeightLogs(userId: string): Promise<boolean> {
    const result = await this.weightLogModel
      .deleteMany({ userId: new Types.ObjectId(userId) })
      .exec();
    return result.deletedCount > 0;
  }
}
