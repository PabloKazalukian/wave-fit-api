import { ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class DayLogValidator {
  async validateCreation() {
    return;
  }

  validateOwnership(dayLog: any, userId: string) {
    if (dayLog.userId.toString() !== userId) {
      throw new ForbiddenException();
    }
  }

  validateUpdate() {
    return;
  }
}
