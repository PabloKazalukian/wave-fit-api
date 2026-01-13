import { Injectable } from '@nestjs/common';
import { CreateRoutineDayInput } from './dto/create-routine-day.input';
import { UpdateRoutineDayInput } from './dto/update-routine-day.input';
import { InjectModel } from '@nestjs/mongoose';
import { RoutineDay } from './schema/routine-day.schema';
import { Model } from 'mongoose';
import { handleError } from 'src/common/utils/handle-error';

@Injectable()
export class RoutineDayService {
  constructor(
    @InjectModel(RoutineDay.name) private routineDayModel: Model<RoutineDay>,
  ) {}

  async create(createRoutineDayInput: CreateRoutineDayInput) {
    try {
      const createdRoutineDay = new this.routineDayModel(createRoutineDayInput);
      return createdRoutineDay.save();
    } catch (error) {
      console.error('Error creating RoutineDay:', error);
      handleError(error);
    }
  }

  async findAll() {
    return this.routineDayModel.find().populate('exercises').exec();
  }

  findOne(id: String) {
    return this.routineDayModel.findById(id).populate('exercises').exec();
  }

  findByCategory(category: string) {
    return this.routineDayModel
      .find({ type: category })
      .populate('exercises')
      .exec();
  }
  findByIds(ids: string[]) {
    return this.routineDayModel
      .find({ _id: { $in: ids } })
      .populate('exercises')
      .exec();
  }

  update(id: number, updateRoutineDayInput: UpdateRoutineDayInput) {
    return `This action updates a #${id} routineDay`;
  }

  remove(id: number) {
    return `This action removes a #${id} routineDay`;
  }
}
