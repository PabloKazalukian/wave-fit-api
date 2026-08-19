import { Inject, Injectable } from '@nestjs/common';
import { STATS_REPOSITORY } from '../../domain/interfaces/repositories/stats.repository.interface';
import type { IStatsRepository } from '../../domain/interfaces/repositories/stats.repository.interface';
import { UserAdherenceDomain } from '../../domain/entities/stats.domain';

@Injectable()
export class GetAdherenceUseCase {
  constructor(
    @Inject(STATS_REPOSITORY)
    private readonly statsRepository: IStatsRepository,
  ) {}

  async execute(userId: string): Promise<UserAdherenceDomain | null> {
    return this.statsRepository.findAdherenceByUser(userId);
  }
}
