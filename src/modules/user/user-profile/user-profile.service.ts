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
import { UpdateGoalsInput } from './dto/update-goals.input';
import { UpdateHealthConstraintsInput } from './dto/update-health-constraints.input';
import { UpdateScheduleInput } from './dto/update-schedule.input';
import { UpdateTrainingPreferenceInput } from './dto/update-training-preference.input';
import { UpdateResourceInput } from './dto/update-resource.input';
import { CreateStrengthMetricInput } from './dto/create-strength-metric.input';
import { CreateWeightLogInput } from './dto/create-weight-log.input';
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
    const [profile, activeGoal, schedule, constraints, metrics] =
      await Promise.all([
        this.profileModel.findOne({ userId }).lean(),
        this.goalModel.findOne({ userId, isActive: true }).lean(),
        this.scheduleModel.findOne({ userId }).lean(),
        this.healthModel.findOne({ userId }).lean(),
        this.strengthModel.findOne({ userId }).lean(),
      ]);

    return {
      profile,
      goal: activeGoal,
      schedule,
      healthConstraints: constraints,
      strengthMetrics: metrics,
    };
  }

  async getFullProfileContext(userId: string) {
    const [
      profile,
      activeGoal,
      schedule,
      constraints,
      trainingPreferences,
      resources,
      strengthMetrics,
      weightLogs,
    ] = await Promise.all([
      this.profileModel.findOne({ userId }).lean(),
      this.goalModel.findOne({ userId, isActive: true }).lean(),
      this.scheduleModel.findOne({ userId }).lean(),
      this.healthModel.findOne({ userId }).lean(),
      this.trainingPreferenceModel.findOne({ userId }).lean(),
      this.resourceModel.findOne({ userId }).lean(),
      this.strengthModel.find({ userId }).sort({ measuredAt: -1 }).lean(),
      this.weightLogModel.find({ userId }).sort({ loggedAt: -1 }).lean(),
    ]);
    console.log('[profile]', profile);
    console.log('[activeGoal]', activeGoal);
    console.log('[schedule]', schedule);
    console.log('[constraints]', constraints);
    console.log('[trainingPreferences]', trainingPreferences);
    console.log('[resources]', resources);
    console.log('[strengthMetrics]', strengthMetrics);
    console.log('[weightLogs]', weightLogs);

    return {
      profile,
      goal: activeGoal,
      healthConstraints: constraints,
      schedule,
      trainingPreferences,
      resources,
      strengthMetrics,
      weightLogs,
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

  // ──────────────────────────────────────────────
  // Upserts 1:1 (crea si no existe)
  // ──────────────────────────────────────────────

  async updateGoals(
    userId: string,
    input: UpdateGoalsInput,
  ): Promise<UserGoal> {
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

  // ──────────────────────────────────────────────
  // Queries 1:1
  // ──────────────────────────────────────────────

  async findGoals(userId: string): Promise<UserGoal | null> {
    return this.goalModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
  }

  async findHealthConstraints(
    userId: string,
  ): Promise<UserHealthConstraint | null> {
    return this.healthModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
  }

  async findSchedule(userId: string): Promise<UserSchedule | null> {
    return this.scheduleModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
  }

  async findTrainingPreference(
    userId: string,
  ): Promise<UserTrainingPreference | null> {
    return this.trainingPreferenceModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
  }

  async findResource(userId: string): Promise<UserResource | null> {
    return this.resourceModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
  }

  // ──────────────────────────────────────────────
  // Colecciones 1:N
  // ──────────────────────────────────────────────

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
}
