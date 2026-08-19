import { Inject, Injectable } from '@nestjs/common';
import { STATS_REPOSITORY } from '../../domain/interfaces/repositories/stats.repository.interface';
import type { IStatsRepository } from '../../domain/interfaces/repositories/stats.repository.interface';
import {
  UserAdherenceDomain,
  AdherenceWeekDomain,
} from '../../domain/entities/stats.domain';

@Injectable()
export class SaveAdherenceUseCase {
  constructor(
    @Inject(STATS_REPOSITORY)
    private readonly statsRepository: IStatsRepository,
  ) {}

  async execute(
    userId: string,
    weeks: {
      weekStartDate: Date;
      totalDays: number;
      completedDays: number;
      skippedDays: number;
      pendingDays: number;
      adherencePercent: number;
    }[],
    computedAt: Date,
  ): Promise<UserAdherenceDomain> {
    const domain = new UserAdherenceDomain(
      null,
      userId,
      computedAt,
      weeks.map(
        (w) =>
          new AdherenceWeekDomain(
            w.weekStartDate,
            w.totalDays,
            w.completedDays,
            w.skippedDays,
            w.pendingDays,
            w.adherencePercent,
          ),
      ),
    );

    return this.statsRepository.upsertAdherence(userId, domain);
  }
}
