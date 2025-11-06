import { Injectable } from '@nestjs/common';
import { CreateRoutinePlanInput } from './dto/create-routine-plan.input';
import { UpdateRoutinePlanInput } from './dto/update-routine-plan.input';
import { InjectModel } from '@nestjs/mongoose';
import { RoutinePlan } from './schema/routine-plan.schema';
import { Model } from 'mongoose';
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

  findAll() {
    return `This action returns all routinePlan`;
  }

  findOne(id: number) {
    return `This action returns a #${id} routinePlan`;
  }

  update(id: number, updateRoutinePlanInput: UpdateRoutinePlanInput) {
    return `This action updates a #${id} routinePlan`;
  }

  remove(id: number) {
    return `This action removes a #${id} routinePlan`;
  }
}
