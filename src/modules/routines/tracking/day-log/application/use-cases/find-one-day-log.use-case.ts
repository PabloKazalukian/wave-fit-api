import { Inject, Injectable } from '@nestjs/common';
import type { IDayLogRepository } from '../../domain/interfaces/repositories/day-log.repository.interface';
import { DAY_LOG_REPOSITORY } from '../../domain/interfaces/repositories/day-log.repository.interface';
import { DayLogDomain } from '../../domain/entities/day-log.domain';

@Injectable()
export class FindOneDayLogUseCase {
  constructor(
    @Inject(DAY_LOG_REPOSITORY)
    private readonly dayLogRepository: IDayLogRepository,
  ) {}

  async execute(id: string, userId: string): Promise<DayLogDomain | null> {
    return this.dayLogRepository.findOne(id, userId);
  }
}
