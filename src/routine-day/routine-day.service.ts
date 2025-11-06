import { Injectable } from '@nestjs/common';
import { CreateRoutineDayInput } from './dto/create-routine-day.input';
import { UpdateRoutineDayInput } from './dto/update-routine-day.input';

@Injectable()
export class RoutineDayService {
  create(createRoutineDayInput: CreateRoutineDayInput) {
    return 'This action adds a new routineDay';
  }

  findAll() {
    return `This action returns all routineDay`;
  }

  findOne(id: number) {
    return `This action returns a #${id} routineDay`;
  }

  update(id: number, updateRoutineDayInput: UpdateRoutineDayInput) {
    return `This action updates a #${id} routineDay`;
  }

  remove(id: number) {
    return `This action removes a #${id} routineDay`;
  }
}
