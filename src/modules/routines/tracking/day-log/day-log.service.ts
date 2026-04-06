import { Injectable } from '@nestjs/common';
import { CreateDayLogInput } from './presentation/dto/create-day-log.input';
import { UpdateDayLogInput } from './presentation/dto/update-day-log.input';

@Injectable()
export class DayLogService {
  create(createDayLogInput: CreateDayLogInput) {
    return 'This action adds a new dayLog';
  }

  findAll() {
    return `This action returns all dayLog`;
  }

  findOne(id: number) {
    return `This action returns a #${id} dayLog`;
  }

  update(id: number, updateDayLogInput: UpdateDayLogInput) {
    return `This action updates a #${id} dayLog`;
  }

  remove(id: number) {
    return `This action removes a #${id} dayLog`;
  }
}
