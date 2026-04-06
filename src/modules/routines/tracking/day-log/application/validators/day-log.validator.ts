import { ForbiddenException, Injectable } from '@nestjs/common';
import { CreateDayLogInput } from '../../presentation/dto/create-day-log.input';
import { UpdateDayLogInput } from '../../presentation/dto/update-day-log.input';

@Injectable()
export class DayLogValidator {
  async validateCreation(input: CreateDayLogInput, userId: string) {
    return;
  }

  validateOwnership(dayLog: any, userId: string) {
    if (dayLog.userId.toString() !== userId) {
      throw new ForbiddenException();
    }
  }

  validateUpdate(input: UpdateDayLogInput) {
    return;
  }
}
