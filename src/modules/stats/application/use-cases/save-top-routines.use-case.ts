import { Inject, Injectable } from '@nestjs/common';
import { STATS_REPOSITORY } from '../../domain/interfaces/repositories/stats.repository.interface';
import type { IStatsRepository } from '../../domain/interfaces/repositories/stats.repository.interface';
import {
  UserTopRoutineDomain,
  TopRoutineEntryDomain,
} from '../../domain/entities/stats.domain';

@Injectable()
export class SaveTopRoutinesUseCase {
  constructor(
    @Inject(STATS_REPOSITORY)
    private readonly statsRepository: IStatsRepository,
  ) {}

  async execute(
    userId: string,
    routines: {
      rank: number;
      planId: string;
      name: string;
      totalWeeks: number;
      totalSessions: number;
      adherenceRate: number;
    }[],
    computedAt: Date,
  ): Promise<UserTopRoutineDomain> {
    const domain = new UserTopRoutineDomain(
      null,
      userId,
      computedAt,
      routines.map(
        (r) =>
          new TopRoutineEntryDomain(
            r.rank,
            r.planId,
            r.name,
            r.totalWeeks,
            r.totalSessions,
            r.adherenceRate,
          ),
      ),
    );

    return this.statsRepository.upsertTopRoutines(userId, domain);
  }
}
