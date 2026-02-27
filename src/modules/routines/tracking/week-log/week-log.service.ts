import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateWeekLogInput } from './dto/create-week-log.input';
import { UpdateWeekLogInput } from './dto/update-week-log.input';
import { WeekLog } from './schema/week-log.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, UpdateQuery } from 'mongoose';
import { addDays, differenceInDays } from 'date-fns';
import { UpdateWeekLogDayInput } from './dto/update-week-log-day.input';
@Injectable()
export class WeekLogService {
  constructor(
    @InjectModel(WeekLog.name) private routinePlanModel: Model<WeekLog>,
  ) {}
  async create(createWeekLogInput: CreateWeekLogInput, userId: Types.ObjectId) {
    const { startDate, endDate, planId } = createWeekLogInput;

    if (differenceInDays(endDate, startDate) !== 6) {
      throw new ForbiddenException('Week must be exactly 7 days');
    }

    const existing = await this.routinePlanModel.findOne({
      userId,
      completed: false,
    });

    if (existing) {
      throw new ForbiddenException('Already active week');
    }

    let isRestMap: boolean[] = new Array(7).fill(false);

    if (planId) {
      const plan = await this.routinePlanModel.db
        .collection('routineplans')
        .findOne({ _id: new Types.ObjectId(planId) });

      if (plan?.week?.length === 7) {
        isRestMap = plan.week.map((d) => d.isRest);
      }
    }

    const days = Array.from({ length: 7 }).map((_, index) => ({
      order: index + 1,
      date: addDays(startDate, index),
      isRest: isRestMap[index] ?? false,
      workoutSessionId: null,
      extraSessionIds: [],
      status: 'pending',
    }));

    const weekLog = new this.routinePlanModel({
      userId,
      startDate,
      endDate,
      planId: planId ? new Types.ObjectId(planId) : null,
      days,
      completed: false,
    });

    return weekLog.save();
  }

  async updateDay(input: UpdateWeekLogDayInput, userId: string) {
    const weekLog = await this.routinePlanModel.findById(input.weekLogId);

    if (!weekLog) throw new NotFoundException('WeekLog not found');

    if (weekLog.userId.toString() !== userId) throw new ForbiddenException();

    const day = weekLog.days.find((d) => d.order === input.order);

    if (!day) throw new NotFoundException('Day not found');

    if (input.status) day.status = input.status;

    await weekLog.save();

    return weekLog;
  }

  async findAllByUser(userId: string): Promise<WeekLog[] | undefined> {
    return this.routinePlanModel.find({ userId }).exec();
  }

  async findOne(
    id: string,
    userId: string,
  ): Promise<WeekLog | null | undefined> {
    const weekLog = await this.routinePlanModel
      .findOne({ _id: id, userId })
      .exec();

    if (!weekLog) {
      throw new NotFoundException(`Week log con ID "${id}" no encontrado`);
    }

    return weekLog;
  }

  async findActiveWeekLog(userId: string): Promise<WeekLog | null | undefined> {
    const weekLog = await this.routinePlanModel
      .findOne({ userId, completed: false })
      .exec();
    if (!weekLog) {
      throw new NotFoundException(`Week log activo no encontrado`);
    }

    return weekLog;
  }

  async update(
    id: string,
    updateWeekLogInput: UpdateWeekLogInput,
    userId: string,
  ) {
    // 1. Verificar que existe y pertenece al usuario
    const weekLog = await this.routinePlanModel.findById(id);

    if (!weekLog) {
      throw new NotFoundException(`WeekLog with ID ${id} not found`);
    }

    if (weekLog.userId.toString() !== userId) {
      throw new ForbiddenException(
        'You do not have permission to update this WeekLog',
      );
    }

    // 2. Preparar datos de actualización
    const updateData: any = {};

    if (updateWeekLogInput.startDate !== undefined) {
      updateData.startDate = new Date(updateWeekLogInput.startDate);
    }

    if (updateWeekLogInput.endDate !== undefined) {
      updateData.endDate = new Date(updateWeekLogInput.endDate);
    }

    if (updateWeekLogInput.planId !== undefined) {
      updateData.planId = updateWeekLogInput.planId
        ? new Types.ObjectId(updateWeekLogInput.planId)
        : null;
    }

    if (updateWeekLogInput.workoutSessionIds !== undefined) {
      // Validar que las WorkoutSessions existen y pertenecen al usuario
      const sessionIds = updateWeekLogInput.workoutSessionIds.map(
        (id) => new Types.ObjectId(id),
      );

      updateData.workoutSessionIds = sessionIds;
    }

    if (updateWeekLogInput.notes !== undefined) {
      updateData.notes = updateWeekLogInput.notes;
    }

    if (updateWeekLogInput.completed !== undefined) {
      updateData.completed = updateWeekLogInput.completed;
    }

    // 3. Actualizar
    const updatedWeekLog = await this.routinePlanModel
      .findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true },
      )
      .lean();

    return updatedWeekLog;
  }

  async findByIdAndUpdate(
    id: string,
    updateQuery: UpdateQuery<WeekLog>,
    options?: { new?: boolean; runValidators?: boolean },
  ): Promise<WeekLog> {
    const weekLog = await this.routinePlanModel
      .findByIdAndUpdate(id, updateQuery, {
        new: options?.new ?? true,
        runValidators: options?.runValidators ?? true,
      })
      .lean();

    if (!weekLog) {
      throw new NotFoundException(`WeekLog with ID ${id} not found`);
    }

    return weekLog;
  }

  remove(id: string) {
    return this.routinePlanModel.deleteOne({ _id: id }).exec();
  }
}
