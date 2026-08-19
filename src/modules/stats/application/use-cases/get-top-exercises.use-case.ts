import { Inject, Injectable } from '@nestjs/common';
import { STATS_REPOSITORY } from '../../domain/interfaces/repositories/stats.repository.interface';
import type { IStatsRepository } from '../../domain/interfaces/repositories/stats.repository.interface';
import { UserTopExerciseDomain } from '../../domain/entities/stats.domain';

@Injectable()
export class GetTopExercisesUseCase {
  constructor(
    @Inject(STATS_REPOSITORY)
    private readonly statsRepository: IStatsRepository,
  ) {}

  async execute(userId: string): Promise<UserTopExerciseDomain | null> {
    return this.statsRepository.findTopExercisesByUser(userId);
  }
}
