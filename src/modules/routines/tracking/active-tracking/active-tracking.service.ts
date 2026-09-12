import { Inject, Injectable } from '@nestjs/common';
import type { IWeekLogRepository } from '../week-log/domain/interfaces/repositories/week-log.repository.interface';
import { WEEK_LOG_REPOSITORY } from '../week-log/domain/interfaces/repositories/week-log.repository.interface';
import type { IDayLogRepository } from '../day-log/domain/interfaces/repositories/day-log.repository.interface';
import { DAY_LOG_REPOSITORY } from '../day-log/domain/interfaces/repositories/day-log.repository.interface';
import { ActiveTracking, TrackingType } from './presentation/entities/active-tracking.entity';

@Injectable()
export class ActiveTrackingService {
  constructor(
    @Inject(WEEK_LOG_REPOSITORY)
    private readonly weekLogRepository: IWeekLogRepository,
    @Inject(DAY_LOG_REPOSITORY)
    private readonly dayLogRepository: IDayLogRepository,
  ) {}

  async hasActiveWeek(userId: string): Promise<boolean> {
    const week = await this.weekLogRepository.findActive(userId);
    return week !== null;
  }

  async hasActiveDay(userId: string): Promise<boolean> {
    const day = await this.dayLogRepository.findActive(userId);
    return day !== null;
  }

  /** Regla dura: no puede haber semana Y día activos simultáneamente. */
  async hasActiveTracking(userId: string): Promise<boolean> {
    const [week, day] = await Promise.all([
      this.hasActiveWeek(userId),
      this.hasActiveDay(userId),
    ]);
    return week || day;
  }

  /** Fuente de verdad de lectura: devuelve qué está activo (DL o WL) o nada. */
  async findActive(userId: string): Promise<ActiveTracking> {
    const [week, day] = await Promise.all([
      this.weekLogRepository.findActive(userId),
      this.dayLogRepository.findActive(userId),
    ]);

    // Prioridad: semana si ambos estuvieran activos (no debería ocurrir por la unicidad)
    if (week) {
      return { hasActive: true, type: TrackingType.WEEK_LOG, week };
    }
    if (day) {
      return { hasActive: true, type: TrackingType.DAY_LOG, day };
    }
    return { hasActive: false };
  }
}
