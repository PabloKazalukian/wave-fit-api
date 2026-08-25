import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserGoal } from '../schema/goals.schema';
import { UpdateGoalsInput } from './dto/update-goals.input';

@Injectable()
export class GoalsService {
  constructor(
    @InjectModel(UserGoal.name) private readonly goalModel: Model<UserGoal>,
  ) {}

  async findGoals(userId: string): Promise<UserGoal | null> {
    return this.goalModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
  }

  async findActiveGoal(userId: string): Promise<UserGoal | null> {
    return this.goalModel
      .findOne({ userId: new Types.ObjectId(userId), isActive: true })
      .exec();
  }

  async updateGoals(userId: string, input: UpdateGoalsInput): Promise<UserGoal> {
    const objectId = new Types.ObjectId(userId);
    const exists = await this.goalModel.exists({ userId: objectId }).exec();
    if (!exists) {
      await this.goalModel.create({
        userId: objectId,
        ...input,
        isActive: true,
      });
    }
    return this.goalModel
      .findOneAndUpdate(
        { userId: objectId },
        { $set: { ...input, userId: objectId, isActive: true } },
        { new: true },
      )
      .orFail()
      .exec();
  }

  async removeGoal(userId: string): Promise<boolean> {
    const result = await this.goalModel
      .deleteMany({ userId: new Types.ObjectId(userId) })
      .exec();
    return result.deletedCount > 0;
  }
}
