import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { isValidLocalDate } from 'src/common/utils/date.utils';
import { DayLogDomain } from '../../domain/entities/day-log.domain';
import { ActiveTrackingService } from '../../../active-tracking/active-tracking.service';

@Injectable()
export class DayLogValidator {
  constructor(
    private readonly activeTrackingService: ActiveTrackingService,
  ) {}

  async validateCreation(date: string, hasActiveDay: boolean) {
    if (!isValidLocalDate(date)) {
      throw new BadRequestException('date must be in yyyy-MM-dd format');
    }

    if (hasActiveDay) {
      throw new ConflictException('Already active day-log');
    }
  }

  /** Fase C: comprueba la exclusividad cruzada (semana activa). */
  async validateNoActiveWeek(userId: string) {
    const hasActiveWeek = await this.activeTrackingService.hasActiveWeek(
      userId,
    );
    if (hasActiveWeek) {
      throw new ConflictException('Already active week-log');
    }
  }

  validateOwnership(dayLog: DayLogDomain, userId: string) {
    if (dayLog.userId !== userId) {
      throw new ForbiddenException();
    }
  }

  validateOwnershipModel(dayLog: any, userId: string) {
    if (dayLog.userId.toString() !== userId) {
      throw new ForbiddenException();
    }
  }
}
