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
import { UpdateHealthConstraintsInput } from './dto/update-health-constraints.input';
import { UpdateScheduleInput } from './dto/update-schedule.input';
import { UpdateResourceInput } from './dto/update-resource.input';
import { CreateStrengthMetricInput } from './dto/create-strength-metric.input';
import { UserHealthConstraint } from './schema/health-constraints.schema';
import { UserSchedule } from './schema/schedule.schema';
import { UserStrengthMetric } from './schema/strength-metrics.schema';
import { UserResource } from './schema/resourse.schema';
import { GoalsService } from './goals/goals.service';
import { TrainingPreferenceService } from './training-preference/training-preference.service';
import { WeightService } from './weight/weight.service';

@Injectable()
export class UserProfileService {
  constructor(
    @InjectModel(UserProfile.name)
    private readonly profileModel: Model<UserProfile>,
    @InjectModel(UserHealthConstraint.name)
    private readonly healthModel: Model<UserHealthConstraint>,
    @InjectModel(UserResource.name)
    private readonly resourceModel: Model<UserResource>,
    @InjectModel(UserSchedule.name)
    private readonly scheduleModel: Model<UserSchedule>,
    @InjectModel(UserStrengthMetric.name)
    private readonly strengthModel: Model<UserStrengthMetric>,
    private readonly goalsService: GoalsService,
    private readonly trainingPreferenceService: TrainingPreferenceService,
    private readonly weightService: WeightService,
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
      gender: input.gender,
      birthDate: input.birthDate ? new Date(input.birthDate) : null,
      heightCm: input.heightCm ?? null,
      weightKg: input.weightKg ?? null,
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
        this.goalsService.findActiveGoal(userId),
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

  // ──────────────────────────────────────────────
  // Agregación cross-domain (composición).
  // Los datos por dominio los proveen los servicios
  // especializados (goals, training-preference, weight)
  // y los modelos aún no migrados.
  // ──────────────────────────────────────────────

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
      this.profileModel.findOne({ userId: new Types.ObjectId(userId) }).exec(),
      this.goalsService.findActiveGoal(userId),
      this.scheduleModel.findOne({ userId: new Types.ObjectId(userId) }).lean(),
      this.healthModel.findOne({ userId: new Types.ObjectId(userId) }).lean(),
      this.trainingPreferenceService.findTrainingPreference(userId),
      this.resourceModel.findOne({ userId: new Types.ObjectId(userId) }).lean(),
      this.strengthModel.find({ userId }).sort({ measuredAt: -1 }).lean(),
      this.weightService.findWeightLogs(userId),
    ]);

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
    if (input.gender !== undefined) updateData.gender = input.gender;
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
  // Health Constraints (upsert 1:1)
  // ──────────────────────────────────────────────

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

  // ──────────────────────────────────────────────
  // Schedule (upsert 1:1)
  // ──────────────────────────────────────────────

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

  // ──────────────────────────────────────────────
  // Resource (upsert 1:1)
  // ──────────────────────────────────────────────

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

  // ──────────────────────────────────────────────
  // Strength Metrics (colección 1:N)
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
}
