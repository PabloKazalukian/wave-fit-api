import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateRoutinePlanInput } from './dto/create-routine-plan.input';
import { UpdateRoutinePlanInput } from './dto/update-routine-plan.input';
import { InjectModel } from '@nestjs/mongoose';
import { RoutinePlan } from './schema/routine-plan.schema';
import { Model, Types } from 'mongoose';
import { handleError } from 'src/common/utils/handle-error';

@Injectable()
export class RoutinePlanService {
  constructor(
    @InjectModel(RoutinePlan.name) private routinePlanModel: Model<RoutinePlan>,
  ) {}

  async create(
    createRoutinePlanInput: CreateRoutinePlanInput,
  ): Promise<RoutinePlan | undefined> {
    try {
      const creadoredRoutinePlan = new this.routinePlanModel(
        createRoutinePlanInput,
      );
      return creadoredRoutinePlan.save();
    } catch (error) {
      handleError(error);
    }
  }

  async findAll() {
    try {
      return this.routinePlanModel.find().exec();
    } catch (error) {
      handleError(error);
    }
  }

  async findOne(id: string) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new NotFoundException(`ID "${id}" no es válido`);
      }

      const plan = await this.routinePlanModel.findById(id).exec();

      if (!plan) {
        throw new NotFoundException(`Plan con ID "${id}" no encontrado`);
      }

      return plan;
    } catch (error) {
      handleError(error);
    }
  }

  async findByTitle(title: string): Promise<RoutinePlan | null | undefined> {
    try {
      return this.routinePlanModel.findOne({ name: title }).exec();
    } catch (error) {
      handleError(error);
    }
  }

  update(id: number, updateRoutinePlanInput: UpdateRoutinePlanInput) {
    return `This action updates a #${id} routinePlan`;
  }

  remove(id: number) {
    return `This action removes a #${id} routinePlan`;
  }
}
