import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserProfile, UserProfileDocument } from './schema/user-profile.schema';
import { CreateUserProfileInput } from './dto/create-user-profile.input';
import { UpdateUserProfileInput } from './dto/update-user-profile.input';
import { GoalsService } from './goals/goals.service';
import { TrainingPreferenceService } from './training-preference/training-preference.service';
import { WeightService } from './weight/weight.service';
import { HealthConstraintsService } from './health-constraints/health-constraints.service';
import { ScheduleService } from './schedule/schedule.service';
import { ResourceService } from './resource/resource.service';
import { StrengthMetricsService } from './strength-metrics/strength-metrics.service';

@Injectable()
export class UserProfileService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UserProfileService.name);

  constructor(
    @InjectModel(UserProfile.name)
    private readonly profileModel: Model<UserProfile>,
    private readonly goalsService: GoalsService,
    private readonly trainingPreferenceService: TrainingPreferenceService,
    private readonly weightService: WeightService,
    private readonly healthConstraintsService: HealthConstraintsService,
    private readonly scheduleService: ScheduleService,
    private readonly resourceService: ResourceService,
    private readonly strengthMetricsService: StrengthMetricsService,
  ) {}

  /**
   * Backfill one-time: normaliza los valores viejos de `distributionDays`
   * (typo `WEKK` + PascalCase con guión) a los valores normalizados actuales.
   *   'Week-log' -> 'week_log'
   *   'Day-log'  -> 'day_log'
   * Idempotente: solo actualiza docs cuyo valor aún no sea uno de los válidos.
   */
  async onApplicationBootstrap(): Promise<void> {
    const LEGACY_MAP: Record<string, string> = {
      'Week-log': 'week_log',
      'Day-log': 'day_log',
      WEKK: 'week_log',
      DAY: 'day_log',
    };

    const profiles = await this.profileModel
      .find({
        distributionDays: {
          $nin: Object.values(LEGACY_MAP),
        },
      })
      .exec();

    let normalized = 0;
    for (const profile of profiles) {
      const normalizedValue = LEGACY_MAP[profile.distributionDays];
      if (!normalizedValue) continue;
      await this.profileModel
        .updateOne({ _id: profile._id }, { $set: { distributionDays: normalizedValue } })
        .exec();
      normalized++;
    }

    if (normalized > 0) {
      this.logger.log(
        `✅ ${normalized} user-profiles normalizados (distributionDays)`,
      );
    }
  }

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
      distributionDays: input.distributionDays ?? 'week_log',
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
        this.scheduleService.findSchedule(userId),
        this.healthConstraintsService.findHealthConstraints(userId),
        this.strengthMetricsService.findStrengthMetrics(userId),
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
      this.scheduleService.findSchedule(userId),
      this.healthConstraintsService.findHealthConstraints(userId),
      this.trainingPreferenceService.findTrainingPreference(userId),
      this.resourceService.findResource(userId),
      this.strengthMetricsService.findStrengthMetrics(userId),
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
    if (input.distributionDays !== undefined)
      updateData.distributionDays = input.distributionDays;

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

  /**
   * Elimina TODOS los datos de perfil de un usuario: perfil base, objetivos,
   * preferencias de entrenamiento, restricciones de salud, agenda, recursos,
   * métricas de fuerza y registros de peso.
   * Operación idempotente: devuelve true aunque el usuario no tuviera datos.
   */
  async removeAllProfileData(userId: string): Promise<boolean> {
    await Promise.all([
      this.goalsService.removeGoal(userId),
      this.trainingPreferenceService.removeTrainingPreference(userId),
      this.weightService.removeWeightLogs(userId),
      this.healthConstraintsService.removeHealthConstraints(userId),
      this.scheduleService.removeSchedule(userId),
      this.resourceService.removeResource(userId),
      this.strengthMetricsService.removeStrengthMetrics(userId),
    ]);

    await this.profileModel
      .deleteMany({ userId: new Types.ObjectId(userId) })
      .exec();

    return true;
  }
}
