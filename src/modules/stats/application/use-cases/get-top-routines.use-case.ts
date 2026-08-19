import { Inject, Injectable } from '@nestjs/common';
import { STATS_REPOSITORY } from '../../domain/interfaces/repositories/stats.repository.interface';
import type { IStatsRepository } from '../../domain/interfaces/repositories/stats.repository.interface';
import { UserTopRoutineDomain } from '../../domain/entities/stats.domain';

@Injectable()
export class GetTopRoutinesUseCase {
  constructor(
    @Inject(STATS_REPOSITORY)
    private readonly statsRepository: IStatsRepository,
  ) {}

  async execute(userId: string): Promise<UserTopRoutineDomain | null> {
    return this.statsRepository.findTopRoutinesByUser(userId);
  }
}
