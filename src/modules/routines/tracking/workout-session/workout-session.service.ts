import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateWorkoutSessionInput } from './dto/create-workout-session.input';
import { UpdateWorkoutSessionInput } from './dto/update-workout-session.input';
import { WorkoutSession } from './schema/workout-session.schema';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { WeekLogService } from '../week-log/week-log.service';
import { WorkoutSessionValidator } from './workout-session.validator';

@Injectable()
export class WorkoutSessionService {
  constructor(
    @InjectModel(WorkoutSession.name)
    private sessionModel: Model<WorkoutSession>,
    private weekLogService: WeekLogService,
    private readonly validator: WorkoutSessionValidator,
  ) {}

  async create(
    input: CreateWorkoutSessionInput,
    userId: string,
  ): Promise<WorkoutSession> {
    let weekLog = null;
    if (input.weekLogId) {
      weekLog = await this.weekLogService.findOne(input.weekLogId, userId);
      if (!weekLog) {
        throw new NotFoundException(
          `Week log con ID "${input.weekLogId}" no encontrado`,
        );
      }
    }

    await this.validator.validateCreation(
      input,
      userId,
      weekLog,
      this.sessionModel,
    );

    const session = await this.sessionModel.create({
      userId: new Types.ObjectId(userId),
      weekLogId: input.weekLogId ? new Types.ObjectId(input.weekLogId) : null,
      date: new Date(input.date),
      routineDayId: input.routineDayId
        ? new Types.ObjectId(input.routineDayId)
        : null,
      exercises: input.exercises,
      status: input.status,
      notes: input.notes || '',
    });

    return session;
  }

  findAllByUser(userId: string): Promise<WorkoutSession[]> {
    return this.sessionModel
      .find({ userId, deleted: { $ne: true } })
      .populate('exercises')
      .exec();
  }

  findOne(id: string, userId: string) {
    return this.sessionModel
      .findOne({ _id: id, userId, deleted: { $ne: true } })
      .populate('exercises')
      .exec();
  }

  async findByDate(date: string, userId: string) {
    const searchDate = new Date(date);
    const nextDay = new Date(searchDate);
    nextDay.setDate(nextDay.getDate() + 1);

    return this.sessionModel
      .findOne({
        userId,
        deleted: { $ne: true },
        date: {
          $gte: searchDate,
          $lt: nextDay,
        },
      })
      .populate('exercises')
      .exec();
  }

  async update(
    id: string,
    updateWorkoutSessionInput: UpdateWorkoutSessionInput,
    userId: string,
  ): Promise<WorkoutSession> {
    const existing = await this.sessionModel.findOne({
      _id: id,
      userId,
      deleted: { $ne: true },
    });
    if (!existing) {
      throw new NotFoundException(`Workout Session with ID "${id}" not found`);
    }

    // Normalize exercises: always derive series from the actual sets count
    if (updateWorkoutSessionInput.exercises) {
      updateWorkoutSessionInput.exercises =
        updateWorkoutSessionInput.exercises.map((ex) => ({
          ...ex,
          series: ex.sets?.length ?? ex.series,
        }));
    }

    await this.validator.validateUpdateWorkoutSession(
      updateWorkoutSessionInput,
      userId,
      existing,
    );

    const { id: _, ...updateData } = updateWorkoutSessionInput;

    const updated = await this.sessionModel
      .findByIdAndUpdate(
        id,
        {
          ...updateData,
          edited: true,
        },
        { new: true },
      )
      .populate('exercises')
      .exec();

    if (!updated) {
      throw new NotFoundException(`Workout Session with ID "${id}" no existe`);
    }

    return updated;
  }

  async remove(id: string, userId: string) {
    const existing = await this.sessionModel.findOne({
      _id: id,
      userId,
      deleted: { $ne: true },
    });
    if (!existing) {
      throw new NotFoundException(`Workout Session with ID "${id}" not found`);
    }

    const updated = await this.sessionModel
      .findByIdAndUpdate(
        id,
        {
          deleted: true,
          deletedAt: new Date(),
        },
        { new: true },
      )
      .populate('exercises')
      .exec();

    return updated;
  }
}
