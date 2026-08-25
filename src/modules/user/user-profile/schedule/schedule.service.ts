import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserSchedule } from '../schema/schedule.schema';
import { UpdateScheduleInput } from './dto/update-schedule.input';

@Injectable()
export class ScheduleService {
  constructor(
    @InjectModel(UserSchedule.name)
    private readonly scheduleModel: Model<UserSchedule>,
  ) {}

  async updateSchedule(
    userId: string,
    input: UpdateScheduleInput,
  ): Promise<UserSchedule> {
    const objectId = new Types.ObjectId(userId);
    const exists = await this.scheduleModel.exists({ userId: objectId }).exec();
    if (!exists) {
      await this.scheduleModel.create({ userId: objectId, ...input });
    }
    return this.scheduleModel
      .findOneAndUpdate(
        { userId: objectId },
        { $set: { ...input, userId: objectId } },
        { new: true },
      )
      .orFail()
      .exec();
  }

  async findSchedule(userId: string): Promise<UserSchedule | null> {
    return this.scheduleModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
  }

  async removeSchedule(userId: string): Promise<boolean> {
    const result = await this.scheduleModel
      .deleteMany({ userId: new Types.ObjectId(userId) })
      .exec();
    return result.deletedCount > 0;
  }
}
