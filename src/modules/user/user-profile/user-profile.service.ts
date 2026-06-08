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
import { UserHealthConstraint } from './schema/health-constraints.schema';
import { UserSchedule } from './schema/schedule.schema';
import { UserStrengthMetric } from './schema/strength-metrics.schema';
import { UserResource } from './schema/resourse.schema';
import { UserTrainingPreference } from './schema/training-preference.schema';
import { UserWeightLog } from './schema/weight.schema';

@Injectable()
export class UserProfileService {
  constructor(
    // @InjectModel(UserProfile.name)
    // private profileModel: Model<UserProfile>,
    // private userGoals: Model<UserGoal>,
    @InjectModel(UserGoal.name) private readonly goalModel: Model<UserGoal>,
    @InjectModel(UserHealthConstraint.name)
    private readonly healthModel: Model<UserHealthConstraint>,
    @InjectModel(UserResource.name)
    private readonly resourceModel: Model<UserResource>,
    @InjectModel(UserSchedule.name)
    private readonly scheduleModel: Model<UserSchedule>,
    @InjectModel(UserStrengthMetric.name)
    private readonly strengthModel: Model<UserStrengthMetric>,
    @InjectModel(UserTrainingPreference.name)
    private readonly trainingPreferenceModel: Model<UserTrainingPreference>,

    @InjectModel(UserProfile.name)
    private readonly profileModel: Model<UserProfile>,
    @InjectModel(UserWeightLog.name)
    private readonly weightLogModel: Model<UserWeightLog>,
    // @InjectModel(UserProfileTrainingPreference.name) private readonly trainingPreferenceModel: Model<UserProfileTrainingPreference>,
    // @InjectModel(WeightLog.name) private readonly weightLogModel: Model<WeightLo>,
    // ... los demás modelos que requieras
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

  async getFullLlmContext(userId: string) {
    // Ejecutamos las consultas en paralelo en MongoDB
    const [
      profile,
      activeGoal,
      schedule,
      constraints,
      metrics,
      trainingPreferences,
      recources,
      weightLogs,
    ] = await Promise.all([
      this.profileModel.findOne({ userId }).lean(),
      this.goalModel.findOne({ userId, isActive: true }).lean(),
      this.scheduleModel.findOne({ userId }).lean(),
      this.healthModel.findOne({ userId }).lean(),
      this.strengthModel.findOne({ userId }).lean(),
      this.trainingPreferenceModel.findOne({ userId }).lean(),
      this.resourceModel.findOne({ userId }).lean(),
      this.weightLogModel.find({ userId }).lean(),
    ]);

    // Retornamos un objeto plano y estructurado listo para ser transformado por tu 'buildUserContextForAI'
    return {
      profile,
      goal: activeGoal,
      schedule,
      healthConstraints: constraints,
      strengthMetrics: metrics,
    };
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
    return this.goalModel.findOne({ isActive: true, userId }).exec();
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
