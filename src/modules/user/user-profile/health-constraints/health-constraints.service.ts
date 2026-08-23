import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserHealthConstraint } from '../schema/health-constraints.schema';
import { UpdateHealthConstraintsInput } from './dto/update-health-constraints.input';

@Injectable()
export class HealthConstraintsService {
  constructor(
    @InjectModel(UserHealthConstraint.name)
    private readonly healthModel: Model<UserHealthConstraint>,
  ) {}

  async updateHealthConstraints(
    userId: string,
    input: UpdateHealthConstraintsInput,
  ): Promise<UserHealthConstraint> {
    const objectId = new Types.ObjectId(userId);
    const exists = await this.healthModel.exists({ userId: objectId }).exec();
    if (!exists) {
      await this.healthModel.create({ userId: objectId });
    }
    const updateData: Record<string, unknown> = {};
    if (input.injuries !== undefined) updateData.injuries = input.injuries;
    if (input.movementRestrictions !== undefined)
      updateData.movementRestrictions = input.movementRestrictions;
    if (input.conditions !== undefined)
      updateData.conditions = input.conditions;
    if (input.mobilityLevel !== undefined)
      updateData.mobilityLevel = input.mobilityLevel;
    if (input.hasHealthcareSupervision !== undefined)
      updateData.hasHealthcareSupervision = input.hasHealthcareSupervision;

    return this.healthModel
      .findOneAndUpdate(
        { userId: objectId },
        { $set: { ...updateData, userId: objectId } },
        { new: true },
      )
      .orFail()
      .exec();
  }

  async findHealthConstraints(
    userId: string,
  ): Promise<UserHealthConstraint | null> {
    return this.healthModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
  }
}
