import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserTrainingPreference } from '../schema/training-preference.schema';
import { UpdateTrainingPreferenceInput } from './dto/update-training-preference.input';

@Injectable()
export class TrainingPreferenceService {
  constructor(
    @InjectModel(UserTrainingPreference.name)
    private readonly trainingPreferenceModel: Model<UserTrainingPreference>,
  ) {}

  async findTrainingPreference(
    userId: string,
  ): Promise<UserTrainingPreference | null> {
    return this.trainingPreferenceModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
  }

  async updateTrainingPreference(
    userId: string,
    input: UpdateTrainingPreferenceInput,
  ): Promise<UserTrainingPreference> {
    const objectId = new Types.ObjectId(userId);
    const exists = await this.trainingPreferenceModel
      .exists({ userId: objectId })
      .exec();
    if (!exists) {
      await this.trainingPreferenceModel.create({ userId: objectId, ...input });
    }
    return this.trainingPreferenceModel
      .findOneAndUpdate(
        { userId: objectId },
        { $set: { ...input, userId: objectId } },
        { new: true },
      )
      .orFail()
      .exec();
  }
}
