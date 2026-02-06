import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateWeekLogInput } from './dto/create-week-log.input';
import { UpdateWeekLogInput } from './dto/update-week-log.input';
import { WeekLog } from './schema/week-log.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { handleError } from '../../../../common/utils/handle-error';

@Injectable()
export class WeekLogService {
  constructor(
    @InjectModel(WeekLog.name) private routinePlanModel: Model<WeekLog>,
  ) {}
  async create(
    createWeekLogInput: CreateWeekLogInput,
    userId: Types.ObjectId,
  ): Promise<WeekLog | undefined> {
    try {
      const weekLog = new this.routinePlanModel(createWeekLogInput);
      weekLog.userId = userId;
      return weekLog.save();
    } catch (error) {
      handleError(error);
    }
  }

  async findAllByUser(userId: string): Promise<WeekLog[] | undefined> {
    try {
      return this.routinePlanModel.find({ userId }).exec();
    } catch (error) {
      handleError(error);
    }
  }

  async findOne(
    id: string,
    userId: string,
  ): Promise<WeekLog | null | undefined> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new NotFoundException(`ID "${id}" no es válido`);
      }
      return this.routinePlanModel.findOne({ _id: id, userId }).exec();
    } catch (error) {
      handleError(error);
    }
    // return `This action returns a #${id} weekLog`;
  }

  async findActiveWeekLog(userId: string): Promise<WeekLog | null | undefined> {
    try {
      return this.routinePlanModel.findOne({ userId, completed: false }).exec();
    } catch (error) {
      handleError(error);
    }
  }

  update(id: string, updateWeekLogInput: UpdateWeekLogInput) {
    try {
      return this.routinePlanModel
        .findOneAndUpdate({ _id: id }, updateWeekLogInput, { new: true })
        .exec();
    } catch (error) {
      handleError(error);
    }
  }

  remove(id: string) {
    try {
      return this.routinePlanModel.deleteOne({ _id: id }).exec();
    } catch (error) {
      handleError(error);
    }
  }
}
