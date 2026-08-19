import { Inject, Injectable } from '@nestjs/common';
import { STATS_REPOSITORY } from '../../domain/interfaces/repositories/stats.repository.interface';
import type { IStatsRepository } from '../../domain/interfaces/repositories/stats.repository.interface';
import { UserPersonalRecordDomain } from '../../domain/entities/stats.domain';

@Injectable()
export class GetPersonalRecordsUseCase {
  constructor(
    @Inject(STATS_REPOSITORY)
    private readonly statsRepository: IStatsRepository,
  ) {}

  async execute(userId: string): Promise<UserPersonalRecordDomain | null> {
    return this.statsRepository.findPersonalRecordsByUser(userId);
  }
}
