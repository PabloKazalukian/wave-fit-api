import { Inject, Injectable } from '@nestjs/common';
import { STATS_REPOSITORY } from '../../domain/interfaces/repositories/stats.repository.interface';
import type { IStatsRepository } from '../../domain/interfaces/repositories/stats.repository.interface';
import {
  UserTopExerciseDomain,
  TopExerciseEntryDomain,
} from '../../domain/entities/stats.domain';

@Injectable()
export class SaveTopExercisesUseCase {
  constructor(
    @Inject(STATS_REPOSITORY)
    private readonly statsRepository: IStatsRepository,
  ) {}

  async execute(
    userId: string,
    exercises: {
      rank: number;
      exerciseId: string;
      name: string;
      category: string;
      totalSessions: number;
      totalVolume: number;
      avgVolumePerSession: number;
    }[],
    computedAt: Date,
  ): Promise<UserTopExerciseDomain> {
    const domain = new UserTopExerciseDomain(
      null,
      userId,
      computedAt,
      exercises.map(
        (e) =>
          new TopExerciseEntryDomain(
            e.rank,
            e.exerciseId,
            e.name,
            e.category,
            e.totalSessions,
            e.totalVolume,
            e.avgVolumePerSession,
          ),
      ),
    );

    return this.statsRepository.upsertTopExercises(userId, domain);
  }
}
