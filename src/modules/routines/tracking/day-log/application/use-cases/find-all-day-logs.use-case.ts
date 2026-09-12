import { Inject, Injectable } from '@nestjs/common';
import type { IDayLogRepository } from '../../domain/interfaces/repositories/day-log.repository.interface';
import { DAY_LOG_REPOSITORY } from '../../domain/interfaces/repositories/day-log.repository.interface';
import { DayLogDomain } from '../../domain/entities/day-log.domain';

@Injectable()
export class FindAllDayLogsUseCase {
  constructor(
    @Inject(DAY_LOG_REPOSITORY)
    private readonly dayLogRepository: IDayLogRepository,
  ) {}

  async execute(
    userId: string,
    limit?: number,
    offset?: number,
  ): Promise<DayLogDomain[]> {
    return this.dayLogRepository.findAllByUser(userId, limit, offset);
  }
}
