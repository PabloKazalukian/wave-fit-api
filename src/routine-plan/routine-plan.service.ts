import { Injectable } from '@nestjs/common';
import { CreateRoutinePlanInput } from './dto/create-routine-plan.input';
import { UpdateRoutinePlanInput } from './dto/update-routine-plan.input';

@Injectable()
export class RoutinePlanService {
  create(createRoutinePlanInput: CreateRoutinePlanInput) {
    return 'This action adds a new routinePlan';
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
