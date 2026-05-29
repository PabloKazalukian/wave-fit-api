import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { CreateWeekLogInput } from '../../presentation/dto/create-week-log.input';
import { WeekLog } from '../../infrastructure/schemas/week-log.schema';
import { Types } from 'mongoose';
import {
  differenceInLocalDays,
  isValidLocalDate,
} from 'src/common/utils/date.utils';
import type { IWeekLogRepository } from '../../domain/interfaces/repositories/week-log.repository.interface';
import { WEEK_LOG_REPOSITORY } from '../../domain/interfaces/repositories/week-log.repository.interface';
import { WeekLogDomain } from '../../domain/entities/week-log.domain';

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

    if (!isValidLocalDate(startDate) || !isValidLocalDate(endDate)) {
      throw new BadRequestException(
        'startDate and endDate must be in yyyy-MM-dd format',
      );
    }

    if (differenceInLocalDays(endDate, startDate) !== 6) {
      throw new ForbiddenException('Week must be exactly 7 days');
    }

    const existing = await this.weekLogRepository.findActive(userId.toString());

    if (existing !== null) {
      throw new ConflictException('Already active week');
    }
  }

  validateOwnership(weekLog: WeekLogDomain, userId: string) {
    if (weekLog.userId !== userId) {
      throw new ForbiddenException();
    }
  }

  validateOwnershipModel(weekLog: WeekLog, userId: string) {
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
    if (!isValidLocalDate(dateStr)) {
      throw new BadRequestException(
        `Date "${dateStr}" must be in yyyy-MM-dd format (no timezone, no UTC)`,
      );
    }
  }
}
