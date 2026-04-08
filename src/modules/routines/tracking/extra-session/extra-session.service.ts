import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateExtraSessionInput } from './dto/create-extra-session.input';
import { UpdateExtraSessionInput } from './dto/update-extra-session.input';
import { ExtraSession } from './schema/extra-session.schema';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { WorkoutSession } from '../workout-session/schema/workout-session.schema';
import { EXTRA_SESSION_DISCIPLINES } from './extra-session.catalog';
import type { ExtraSessionDisciplineKey } from './extra-session.catalog';

@Injectable()
export class ExtraSessionService {
  constructor(
    @InjectModel(ExtraSession.name)
    private extraSessionModel: Model<ExtraSession>,
    @InjectModel(WorkoutSession.name)
    private workoutSessionModel: Model<WorkoutSession>,
  ) {}

  async create(
    input: CreateExtraSessionInput,
    userId: string,
  ): Promise<ExtraSession> {
    let workoutSession = await this.workoutSessionModel.findOne({
      _id: input.workoutSessionId,
      userId,
    });

    if (!workoutSession) {
      workoutSession = await this.workoutSessionModel.create({
        userId: new Types.ObjectId(userId),
        weekLogId: null,
        date: new Date(input.date),
        exercises: [],
        status: 'not_started',
        edited: false,
      });
    }

    const config =
      EXTRA_SESSION_DISCIPLINES[input.discipline as ExtraSessionDisciplineKey];
    if (!config) {
      throw new BadRequestException(
        `Disciplina desconocida: ${input.discipline}`,
      );
    }

    const WEIGHT_KG = 70;
    const intensityFactor = 1 + (input.intensityLevel - 3) * 0.15;
    const backendCalories = Math.round(
      config.met * WEIGHT_KG * (input.duration / 60) * intensityFactor,
    );
    const calories =
      input.calories !== undefined &&
      Math.abs(input.calories - backendCalories) <= 400
        ? input.calories
        : backendCalories;

    const extraSession = await this.extraSessionModel.create({
      userId: new Types.ObjectId(userId),
      workoutSessionId: new Types.ObjectId(input.workoutSessionId),
      category: config.category,
      date: new Date(input.date),
      discipline: input.discipline,
      duration: input.duration,
      intensityLevel: input.intensityLevel,
      calories,
      notes: input.notes || '',
    });

    return extraSession;
  }

  async findAllByUser(userId: string): Promise<ExtraSession[]> {
    return this.extraSessionModel.find({ userId }).exec();
  }

  async findOne(id: string, userId: string): Promise<ExtraSession> {
    const extraSession = await this.extraSessionModel.findOne({
      _id: id,
      userId,
    });

    if (!extraSession) {
      throw new NotFoundException(`ExtraSession con ID "${id}" no encontrada`);
    }

    return extraSession;
  }

  async findByWorkoutSession(
    workoutSessionId: string,
    userId: string,
  ): Promise<ExtraSession[]> {
    return this.extraSessionModel
      .find({
        workoutSessionId: new Types.ObjectId(workoutSessionId),
        userId,
      })
      .exec();
  }

  async update(
    id: string,
    input: UpdateExtraSessionInput,
    userId: string,
  ): Promise<ExtraSession> {
    const extraSession = await this.extraSessionModel.findOne({
      _id: id,
      userId,
    });

    if (!extraSession) {
      throw new NotFoundException(`ExtraSession con ID "${id}" no encontrada`);
    }

    if (input.discipline !== undefined) {
      const config =
        EXTRA_SESSION_DISCIPLINES[
          input.discipline as ExtraSessionDisciplineKey
        ];
      if (!config) {
        throw new BadRequestException(
          `Disciplina desconocida: ${input.discipline}`,
        );
      }
      extraSession.discipline = input.discipline as any;
      extraSession.category = config.category;
    }
    if (input.duration !== undefined) extraSession.duration = input.duration;
    if (input.intensityLevel !== undefined)
      extraSession.intensityLevel = input.intensityLevel;

    if (input.calories !== undefined) {
      const config =
        EXTRA_SESSION_DISCIPLINES[
          extraSession.discipline as ExtraSessionDisciplineKey
        ];
      const WEIGHT_KG = 70;
      const intensityFactor = 1 + (extraSession.intensityLevel - 3) * 0.15;
      const backendCalories = Math.round(
        config.met * WEIGHT_KG * (extraSession.duration / 60) * intensityFactor,
      );
      const diff = Math.abs(input.calories - backendCalories);
      extraSession.calories = diff <= 400 ? input.calories : backendCalories;
    } else if (
      input.duration !== undefined ||
      input.discipline !== undefined ||
      input.intensityLevel !== undefined
    ) {
      const config =
        EXTRA_SESSION_DISCIPLINES[
          extraSession.discipline as ExtraSessionDisciplineKey
        ];
      const WEIGHT_KG = 70;
      const intensityFactor = 1 + (extraSession.intensityLevel - 3) * 0.15;
      extraSession.calories = Math.round(
        config.met * WEIGHT_KG * (extraSession.duration / 60) * intensityFactor,
      );
    }

    if (input.notes !== undefined) extraSession.notes = input.notes;

    return extraSession.save();
  }

  async remove(id: string, userId: string): Promise<boolean> {
    const result = await this.extraSessionModel.deleteOne({
      _id: id,
      userId,
    });

    return result.deletedCount > 0;
  }
}
