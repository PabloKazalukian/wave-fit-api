import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserResource } from '../schema/resourse.schema';
import { UpdateResourceInput } from './dto/update-resource.input';

@Injectable()
export class ResourceService {
  constructor(
    @InjectModel(UserResource.name)
    private readonly resourceModel: Model<UserResource>,
  ) {}

  async updateResource(
    userId: string,
    input: UpdateResourceInput,
  ): Promise<UserResource> {
    const objectId = new Types.ObjectId(userId);
    const exists = await this.resourceModel.exists({ userId: objectId }).exec();
    if (!exists) {
      await this.resourceModel.create({ userId: objectId, ...input });
    }
    return this.resourceModel
      .findOneAndUpdate(
        { userId: objectId },
        { $set: { ...input, userId: objectId } },
        { new: true },
      )
      .orFail()
      .exec();
  }

  async findResource(userId: string): Promise<UserResource | null> {
    return this.resourceModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
  }

  async removeResource(userId: string): Promise<boolean> {
    const result = await this.resourceModel
      .deleteMany({ userId: new Types.ObjectId(userId) })
      .exec();
    return result.deletedCount > 0;
  }
}
