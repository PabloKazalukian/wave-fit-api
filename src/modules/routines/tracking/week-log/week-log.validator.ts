import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { CreateWeekLogInput } from './dto/create-week-log.input';
import { UpdateWeekLogInput } from './dto/update-week-log.input';
import { WeekLog } from './schema/week-log.schema';
import { Model, Types } from 'mongoose';
import { differenceInDays, parseISO, isValid } from 'date-fns';

@Injectable()
export class WeekLogValidator {
  async validateCreation(
    createWeekLogInput: CreateWeekLogInput,
    userId: Types.ObjectId,
    weekLogModel: Model<WeekLog>,
  ) {
    const { startDate, endDate } = createWeekLogInput;

    if (differenceInDays(endDate, startDate) !== 6) {
      throw new ForbiddenException('Week must be exactly 7 days');
    }

    const existing = await weekLogModel.findOne({
      userId,
      active: true,
    });

    if (existing) {
      throw new ConflictException('Already active week');
    }
  }

  validateOwnership(weekLog: WeekLog, userId: string) {
    if (weekLog.userId.toString() !== userId) {
      throw new ForbiddenException();
    }
  }

  validateUpdate(updateWeekLogInput: UpdateWeekLogInput) {
    if (updateWeekLogInput.startDate) {
      this.validateLocalDateFormat(updateWeekLogInput.startDate);
    }
    if (updateWeekLogInput.endDate) {
      this.validateLocalDateFormat(updateWeekLogInput.endDate);
    }
  }

  private validateLocalDateFormat(dateStr: string) {
    if (typeof dateStr !== 'string') {
      throw new BadRequestException('Date must be a string');
    }
    const parsedDate = parseISO(dateStr);
    if (!isValid(parsedDate)) {
      throw new BadRequestException(
        `Date ${dateStr} is not a valid date string`,
      );
    }
    // Requisito: que sea formato de fecha tipo local.
    // Usualmente esto significa sin el designador Z de UTC o sin offset horario.
    if (dateStr.toUpperCase().endsWith('Z')) {
      throw new BadRequestException(
        `Date ${dateStr} should be in local format, not UTC (Z)`,
      );
    }
  }
}
