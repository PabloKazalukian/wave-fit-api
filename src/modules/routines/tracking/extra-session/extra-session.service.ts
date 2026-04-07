import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
    const workoutSession = await this.workoutSessionModel.findOne({
      _id: input.workoutSessionId,
      userId,
    });

    if (!workoutSession) {
      throw new NotFoundException(
        `WorkoutSession con ID "${input.workoutSessionId}" no encontrada`,
      );
    }

    const config = EXTRA_SESSION_DISCIPLINES[input.discipline as ExtraSessionDisciplineKey];
    if (!config) {
      throw new BadRequestException(`Disciplina desconocida: ${input.discipline}`);
    }

    const calculatedCalories = input.calories || Math.round((config.avgCaloriesPerHour / 60) * input.duration);

    const extraSession = await this.extraSessionModel.create({
      userId: new Types.ObjectId(userId),
      workoutSessionId: new Types.ObjectId(input.workoutSessionId),
      category: config.category,
      date: new Date(input.date),
      discipline: input.discipline,
      duration: input.duration,
      intensityLevel: input.intensityLevel,
      calories: calculatedCalories,
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
      const config = EXTRA_SESSION_DISCIPLINES[input.discipline as ExtraSessionDisciplineKey];
      if (!config) {
        throw new BadRequestException(`Disciplina desconocida: ${input.discipline}`);
      }
      extraSession.discipline = input.discipline as any;
      extraSession.category = config.category;
    }
    if (input.duration !== undefined) extraSession.duration = input.duration;
    if (input.intensityLevel !== undefined)
      extraSession.intensityLevel = input.intensityLevel;
    
    // Si envían calories explícitamente se actualiza.
    if (input.calories !== undefined) {
      extraSession.calories = input.calories;
    } else if (input.duration !== undefined || input.discipline !== undefined) {
        // Recalcular si cambiaron duracion o disciplina y NO pasaron las calorias nuevas
        const config = EXTRA_SESSION_DISCIPLINES[extraSession.discipline as ExtraSessionDisciplineKey];
        extraSession.calories = Math.round((config.avgCaloriesPerHour / 60) * extraSession.duration);
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
