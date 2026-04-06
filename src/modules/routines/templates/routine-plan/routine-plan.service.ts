import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateRoutinePlanInput } from './dto/create-routine-plan.input';
import { UpdateRoutinePlanInput } from './dto/update-routine-plan.input';
import { InjectModel } from '@nestjs/mongoose';
import { RoutinePlan as RoutinePlanSchema } from './schema/routine-plan.schema';
import { RoutinePlan } from './entities/routine-plan.entity';
import { Model, Types } from 'mongoose';
import { serializeMongo } from 'src/common/utils/mongo.utils';

@Injectable()
export class RoutinePlanService {
  constructor(
    @InjectModel(RoutinePlanSchema.name)
    private routinePlanModel: Model<RoutinePlanSchema>,
  ) {}

  async create(input: CreateRoutinePlanInput): Promise<RoutinePlan> {
    const week = (input.routineDays || []).map((id, index) => ({
      day: id ? new Types.ObjectId(id) : null,
      isRest: !id,
      order: index,
    }));

    const plan = await this.routinePlanModel.create({
      ...input,
      week,
    });
    return serializeMongo<RoutinePlan>(plan);
  }

  async findAll(): Promise<RoutinePlan[]> {
    const docs = await this.routinePlanModel.find().lean().exec();
    return serializeMongo<RoutinePlan[]>(docs);
  }

  async findOne(id: string): Promise<RoutinePlan> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`ID "${id}" no es válido`);
    }

    const plan = await this.routinePlanModel.findById(id).lean().exec();

    if (!plan) {
      throw new NotFoundException(`Plan con ID "${id}" no encontrado`);
    }

    return serializeMongo<RoutinePlan>(plan);
  }

  async findOneWithDays(id: string): Promise<RoutinePlan> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`ID "${id}" no es válido`);
    }

    const plan = await this.routinePlanModel
      .findById(id)
      .populate('week.day')
      .lean()
      .exec();

    if (!plan) {
      throw new NotFoundException(`Plan con ID "${id}" no encontrado`);
    }

    return serializeMongo<RoutinePlan>(plan);
  }

  async findByTitle(title: string): Promise<RoutinePlan | null> {
    const doc = await this.routinePlanModel
      .findOne({ name: title })
      .lean()
      .exec();
    return doc ? serializeMongo<RoutinePlan>(doc) : null;
  }

  async update(
    id: string,
    updateRoutinePlanInput: UpdateRoutinePlanInput,
  ): Promise<RoutinePlan> {
    const updated = await this.routinePlanModel
      .findByIdAndUpdate(id, updateRoutinePlanInput, { new: true })
      .lean()
      .exec();

    if (!updated) {
      throw new NotFoundException(`Plan with id ${id} not found`);
    }

    return serializeMongo<RoutinePlan>(updated);
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.routinePlanModel.findByIdAndDelete(id).exec();
    return !!result;
  }
}
