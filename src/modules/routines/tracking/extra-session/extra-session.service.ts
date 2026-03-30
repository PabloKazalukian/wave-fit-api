import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateExtraSessionInput } from './dto/create-extra-session.input';
import { UpdateExtraSessionInput } from './dto/update-extra-session.input';
import { ExtraSession } from './schema/extra-session.schema';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { WorkoutSession } from '../workout-session/schema/workout-session.schema';

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

    const extraSession = await this.extraSessionModel.create({
      userId: new Types.ObjectId(userId),
      workoutSessionId: new Types.ObjectId(input.workoutSessionId),
      type: input.type,
      date: new Date(input.date),
      discipline: input.discipline,
      duration: input.duration,
      intensityLevel: input.intensityLevel,
      calories: input.calories,
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

    if (input.type !== undefined) extraSession.type = input.type;
    if (input.discipline !== undefined)
      extraSession.discipline = input.discipline;
    if (input.duration !== undefined) extraSession.duration = input.duration;
    if (input.intensityLevel !== undefined)
      extraSession.intensityLevel = input.intensityLevel;
    if (input.calories !== undefined) extraSession.calories = input.calories;
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
