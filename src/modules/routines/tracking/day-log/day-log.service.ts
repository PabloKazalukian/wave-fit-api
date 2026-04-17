import { Injectable } from '@nestjs/common';

@Injectable()
export class DayLogService {
  create() {
    return 'This action adds a new dayLog';
  }

  findAll() {
    return `This action returns all dayLog`;
  }

  findOne(id: number) {
    return `This action returns a #${id} dayLog`;
  }

  update(id: number) {
    return `This action updates a #${id} dayLog`;
  }

  remove(id: number) {
    return `This action removes a #${id} dayLog`;
  }
}
