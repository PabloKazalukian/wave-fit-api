import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { CreateWeekLogInput } from '../../presentation/dto/create-week-log.input';
import { WeekLog } from '../../infrastructure/schemas/week-log.schema';
import { Model, Types } from 'mongoose';
import { differenceInDays, parseISO, isValid } from 'date-fns';
import type { IWeekLogRepository } from '../../domain/interfaces/repositories/week-log.repository.interface';
import { WEEK_LOG_REPOSITORY } from '../../domain/interfaces/repositories/week-log.repository.interface';

@Injectable()
export class WeekLogValidator {
  constructor(
    @Inject(WEEK_LOG_REPOSITORY)
    private readonly weekLogRepository: IWeekLogRepository,
  ) {}

  async validateCreation(
    createWeekLogInput: CreateWeekLogInput,
    userId: Types.ObjectId,
  ) {
    const { startDate, endDate } = createWeekLogInput;

    if (differenceInDays(endDate, startDate) !== 6) {
      throw new ForbiddenException('Week must be exactly 7 days');
    }

    const existing = await this.weekLogRepository.findActive(userId.toString());

    if (existing !== null) {
      throw new ConflictException('Already active week');
    }
  }

  validateOwnership(weekLog: WeekLog, userId: string) {
    if (weekLog.userId.toString() !== userId) {
      throw new ForbiddenException();
    }
  }

  validateUpdate(updateWeekLogInput: { startDate?: string; endDate?: string }) {
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
