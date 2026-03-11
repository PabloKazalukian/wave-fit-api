import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateRoutinePlanInput } from './dto/create-routine-plan.input';
import { UpdateRoutinePlanInput } from './dto/update-routine-plan.input';
import { InjectModel } from '@nestjs/mongoose';
import { RoutinePlan } from './schema/routine-plan.schema';
import { Model, Types } from 'mongoose';

@Injectable()
export class RoutinePlanService {
  constructor(
    @InjectModel(RoutinePlan.name) private routinePlanModel: Model<RoutinePlan>,
  ) {}

  async create(input: CreateRoutinePlanInput) {
    const week = (input.routineDays || []).map((id, index) => ({
      day: id ? new Types.ObjectId(id) : null,
      isRest: !id,
      order: index,
    }));

    const plan = await this.routinePlanModel.create({
      ...input,
      week,
    });
    return plan;
  }

  async findAll(): Promise<RoutinePlan[] | undefined> {
    return this.routinePlanModel.find().exec();
  }

  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`ID "${id}" no es válido`);
    }

    const plan = await this.routinePlanModel
      .findById(id)
      .populate('week.day')
      .exec();

    if (!plan) {
      throw new NotFoundException(`Plan con ID "${id}" no encontrado`);
    }

    return plan;
  }

  async findByTitle(title: string): Promise<RoutinePlan | null | undefined> {
    return this.routinePlanModel.findOne({ name: title }).exec();
  }

  update(id: number, updateRoutinePlanInput: UpdateRoutinePlanInput) {
    return `This action updates a #${id} routinePlan`;
  }

  remove(id: String) {
    return `This action removes a #${id} routinePlan`;
  }
}
