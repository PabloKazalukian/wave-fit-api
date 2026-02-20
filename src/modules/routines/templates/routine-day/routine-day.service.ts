import { Injectable } from '@nestjs/common';
import { CreateRoutineDayInput } from './dto/create-routine-day.input';
import { UpdateRoutineDayInput } from './dto/update-routine-day.input';
import { InjectModel } from '@nestjs/mongoose';
import { RoutineDay } from './schema/routine-day.schema';
import { Model } from 'mongoose';

@Injectable()
export class RoutineDayService {
  constructor(
    @InjectModel(RoutineDay.name) private routineDayModel: Model<RoutineDay>,
  ) {}

  async create(createRoutineDayInput: CreateRoutineDayInput) {
    const createdRoutineDay = new this.routineDayModel(createRoutineDayInput);
    return createdRoutineDay.save();
  }

  async findAll() {
    const docs = await this.routineDayModel
      .find()
      .populate({
        path: 'exercises.exercise',
        select: 'name category',
      })
      .exec();
    return docs.map((doc) => doc.toObject({ virtuals: true }));
  }

  async findOne(id: string) {
    const docs = await this.routineDayModel
      .findById(id)
      .populate({
        path: 'exercises.exercise',
        select: 'name category',
      })
      .exec();
    return docs?.toObject({ virtuals: true });
    // .lean({ virtuals: true }); // importante
  }

  async findByCategory(category: string) {
    const docs = await this.routineDayModel
      .find({ type: category })
      .populate({
        path: 'exercises.exercise',
        select: 'name category',
      })
      .exec();
    return docs.map((doc) => doc.toObject({ virtuals: true }));
  }

  // const docs = await this.routineDayModel.find().exec();
  // return docs.map(doc => doc.toJSON());
  async findByIds(ids: string[]) {
    const docs = await this.routineDayModel
      .find({ _id: { $in: ids } })
      .populate('exercises')
      .exec();
    return docs.map((doc) => doc.toObject({ virtuals: true }));
  }

  update(id: number, updateRoutineDayInput: UpdateRoutineDayInput) {
    return `This action updates a #${id} routineDay`;
  }

  remove(id: number) {
    return `This action removes a #${id} routineDay`;
  }
}
