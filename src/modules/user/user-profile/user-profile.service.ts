import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserProfile, UserProfileDocument } from './schema/user-profile.schema';
import { CreateUserProfileInput } from './dto/create-user-profile.input';
import { UpdateUserProfileInput } from './dto/update-user-profile.input';
import { UserGoal } from './schema/goals.schema';

@Injectable()
export class UserProfileService {
  constructor(
    @InjectModel(UserProfile.name)
    private profileModel: Model<UserProfile>,
    private userGoals: Model<UserGoal>,
  ) {}

  async create(
    input: CreateUserProfileInput,
    userId: string,
  ): Promise<UserProfileDocument> {
    const existing = await this.profileModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();

    if (existing) {
      throw new BadRequestException(
        'User already has a profile. Use updateUserProfile to modify it.',
      );
    }

    const profile = await this.profileModel.create({
      userId: new Types.ObjectId(userId),
      sex: input.sex,
      birthDate: new Date(input.birthDate),
      heightCm: input.heightCm,
      weightKg: input.weightKg,
      bodyFatPct: input.bodyFatPct ?? null,
      unitsPreference: input.unitsPreference ?? 'metric',
    });

    return profile;
  }

  async findAll(): Promise<UserProfileDocument[]> {
    return this.profileModel.find().exec();
  }

  async findOne(
    id: string,
    userId: string,
  ): Promise<UserProfileDocument | null> {
    return this.profileModel
      .findOne({
        _id: new Types.ObjectId(id),
        userId: new Types.ObjectId(userId),
      })
      .exec();
  }

  async findByUserId(userId: string): Promise<UserProfileDocument | null> {
    return this.profileModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
  }

  async update(
    id: string,
    input: UpdateUserProfileInput,
    userId: string,
  ): Promise<UserProfileDocument> {
    const existing = await this.profileModel.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    });

    if (!existing) {
      throw new NotFoundException('User profile not found');
    }

    const updateData: Record<string, unknown> = {};
    if (input.sex !== undefined) updateData.sex = input.sex;
    if (input.birthDate !== undefined)
      updateData.birthDate = new Date(input.birthDate);
    if (input.heightCm !== undefined) updateData.heightCm = input.heightCm;
    if (input.weightKg !== undefined) updateData.weightKg = input.weightKg;
    if (input.bodyFatPct !== undefined)
      updateData.bodyFatPct = input.bodyFatPct;
    if (input.unitsPreference !== undefined)
      updateData.unitsPreference = input.unitsPreference;

    const updated = await this.profileModel
      .findByIdAndUpdate(id, { $set: updateData }, { new: true })
      .exec();

    if (!updated) {
      throw new NotFoundException('User profile not found after update');
    }

    return updated;
  }

  async findUserGoalsActive(userId: string) {
    return this.userGoals.findOne({ isActive: true, userId }).exec();
  }

  async upsert(
    input: CreateUserProfileInput | UpdateUserProfileInput,
    userId: string,
  ): Promise<UserProfileDocument> {
    const existing = await this.profileModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();

    if (existing) {
      return this.update(
        existing._id.toString(),
        input as UpdateUserProfileInput,
        userId,
      );
    }

    return this.create(input as CreateUserProfileInput, userId);
  }

  async remove(id: string, userId: string): Promise<UserProfileDocument> {
    const existing = await this.profileModel.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    });

    if (!existing) {
      throw new NotFoundException('User profile not found');
    }

    const deleted = await this.profileModel.findByIdAndDelete(id).exec();

    if (!deleted) {
      throw new NotFoundException('User profile not found');
    }

    return deleted;
  }
}
