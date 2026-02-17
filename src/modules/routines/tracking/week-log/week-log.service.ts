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
import { differenceInDays } from 'date-fns';
@Injectable()
export class WeekLogService {
  constructor(
    @InjectModel(WeekLog.name) private routinePlanModel: Model<WeekLog>,
  ) {}
  async create(
    createWeekLogInput: CreateWeekLogInput,
    userId: Types.ObjectId,
  ): Promise<WeekLog | undefined> {
    if (createWeekLogInput.startDate > createWeekLogInput.endDate) {
      throw new ForbiddenException('endDate must be after startDate');
    }

    if (
      differenceInDays(
        createWeekLogInput.startDate,
        createWeekLogInput.endDate,
      ) < 7
    ) {
      throw new ForbiddenException(
        'The date range must be at least 7 days apart',
      );
    }

    const activeWeekLog = await this.findActiveWeekLog(userId.toString());
    if (activeWeekLog !== null && activeWeekLog !== undefined) {
      throw new ForbiddenException(
        `Ya existe una semana activa
        ${activeWeekLog}`,
      );
    }

    const weekLog = new this.routinePlanModel({
      ...createWeekLogInput,
      completed: false,
    });
    weekLog.userId = userId;
    return weekLog.save();
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
