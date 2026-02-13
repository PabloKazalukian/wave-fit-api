import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateWeekLogInput } from './dto/create-week-log.input';
import { UpdateWeekLogInput } from './dto/update-week-log.input';
import { WeekLog } from './schema/week-log.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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

  update(id: string, updateWeekLogInput: UpdateWeekLogInput) {
    return this.routinePlanModel
      .findOneAndUpdate({ _id: id }, updateWeekLogInput, { new: true })
      .exec();
  }

  remove(id: string) {
    return this.routinePlanModel.deleteOne({ _id: id }).exec();
  }
}
