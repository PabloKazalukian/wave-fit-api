import { Injectable } from '@nestjs/common';
import { CreateWeekLogInput } from './dto/create-week-log.input';
import { UpdateWeekLogInput } from './dto/update-week-log.input';

@Injectable()
export class WeekLogService {
  create(createWeekLogInput: CreateWeekLogInput) {
    return 'This action adds a new weekLog';
  }

  findAll() {
    return `This action returns all weekLog`;
  }

  findOne(id: number) {
    return `This action returns a #${id} weekLog`;
  }

  update(id: number, updateWeekLogInput: UpdateWeekLogInput) {
    return `This action updates a #${id} weekLog`;
  }

  remove(id: number) {
    return `This action removes a #${id} weekLog`;
  }
}
