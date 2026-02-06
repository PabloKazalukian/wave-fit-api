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

  async create(
    createRoutinePlanInput: CreateRoutinePlanInput,
  ): Promise<RoutinePlan | undefined> {
    const creadoredRoutinePlan = new this.routinePlanModel(
      createRoutinePlanInput,
    );
    return creadoredRoutinePlan.save();
  }

  async findAll(): Promise<RoutinePlan[] | undefined> {
    return this.routinePlanModel.find().exec();
  }

  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`ID "${id}" no es válido`);
    }

    const plan = await this.routinePlanModel.findById(id).exec();

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

  remove(id: number) {
    return `This action removes a #${id} routinePlan`;
  }
}
