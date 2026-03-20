import { Injectable } from '@nestjs/common';
import { CreateRoutineDayInput } from './dto/create-routine-day.input';
import { UpdateRoutineDayInput } from './dto/update-routine-day.input';
import { InjectModel } from '@nestjs/mongoose';
import { RoutineDay as RoutineDaySchema } from './schema/routine-day.schema';
import { RoutineDay } from './entities/routine-day.entity';
import { Model } from 'mongoose';
import { serializeMongo } from 'src/common/utils/mongo.utils';

@Injectable()
export class RoutineDayService {
  constructor(
    @InjectModel(RoutineDaySchema.name)
    private routineDayModel: Model<RoutineDaySchema>,
  ) {}

  async create(
    createRoutineDayInput: CreateRoutineDayInput,
  ): Promise<RoutineDay> {
    const created = await this.routineDayModel.create(createRoutineDayInput);
    return serializeMongo<RoutineDay>(created);
  }

  async findAll(): Promise<RoutineDay[]> {
    const docs = await this.routineDayModel
      .find()
      .populate({
        path: 'exercises.exercise',
        select: 'name category',
      })
      .lean()
      .exec();
    return serializeMongo<RoutineDay[]>(docs);
  }

  async findOne(id: string): Promise<RoutineDay | null> {
    const doc = await this.routineDayModel
      .findById(id)
      .populate({
        path: 'exercises.exercise',
        select: 'name category',
      })
      .lean()
      .exec();
    return doc ? serializeMongo<RoutineDay>(doc) : null;
  }

  async findByCategory(category: string): Promise<RoutineDay[]> {
    const docs = await this.routineDayModel
      .find({ type: category })
      .populate({
        path: 'exercises.exercise',
        select: 'name category',
      })
      .lean()
      .exec();
    return serializeMongo<RoutineDay[]>(docs);
  }

  // const docs = await this.routineDayModel.find().exec();
  // return docs.map(doc => doc.toJSON());
  async findByIds(ids: string[]): Promise<RoutineDay[]> {
    const docs = await this.routineDayModel
      .find({ _id: { $in: ids } })
      .populate({
        path: 'exercises.exercise',
        select: 'name category type ',
      })
      .lean()
      .exec();
    return serializeMongo<RoutineDay[]>(docs);
  }

  async update(
    id: string,
    updateRoutineDayInput: UpdateRoutineDayInput,
  ): Promise<RoutineDay> {
    const updated = await this.routineDayModel
      .findByIdAndUpdate(id, updateRoutineDayInput, { new: true })
      .populate({
        path: 'exercises.exercise',
        select: 'name category',
      })
      .lean()
      .exec();

    if (!updated) {
      throw new Error(`RoutineDay with id ${id} not found`);
    }

    return serializeMongo<RoutineDay>(updated);
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.routineDayModel.findByIdAndDelete(id).exec();
    return !!result;
  }
}
