import { Inject, Injectable } from '@nestjs/common';
import { STATS_REPOSITORY } from '../../domain/interfaces/repositories/stats.repository.interface';
import type { IStatsRepository } from '../../domain/interfaces/repositories/stats.repository.interface';
import {
  UserPersonalRecordDomain,
  PersonalRecordEntryDomain,
} from '../../domain/entities/stats.domain';

@Injectable()
export class SavePersonalRecordsUseCase {
  constructor(
    @Inject(STATS_REPOSITORY)
    private readonly statsRepository: IStatsRepository,
  ) {}

  async execute(
    userId: string,
    records: {
      exerciseId: string;
      exerciseName: string;
      category: string;
      oneRmEstimated: number;
      bestWeight: number;
      bestReps: number;
      bestVolume: number;
      achievedAt: Date;
      previousOneRm: number | null;
    }[],
    computedAt: Date,
  ): Promise<UserPersonalRecordDomain> {
    const domain = new UserPersonalRecordDomain(
      null,
      userId,
      computedAt,
      records.map(
        (r) =>
          new PersonalRecordEntryDomain(
            r.exerciseId,
            r.exerciseName,
            r.category,
            r.oneRmEstimated,
            r.bestWeight,
            r.bestReps,
            r.bestVolume,
            r.achievedAt,
            r.previousOneRm,
          ),
      ),
    );

    return this.statsRepository.upsertPersonalRecords(userId, domain);
  }
}
