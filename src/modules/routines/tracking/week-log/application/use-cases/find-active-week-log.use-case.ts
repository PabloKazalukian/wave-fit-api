import { Inject, Injectable } from '@nestjs/common';
import type { IWeekLogRepository } from '../../domain/interfaces/repositories/week-log.repository.interface';
import { WEEK_LOG_REPOSITORY } from '../../domain/interfaces/repositories/week-log.repository.interface';
import { WeekLogDomain } from '../../domain/entities/week-log.domain';

@Injectable()
export class FindActiveWeekLogUseCase {
  constructor(
    @Inject(WEEK_LOG_REPOSITORY)
    private readonly weekLogRepository: IWeekLogRepository,
  ) {}

  async execute(userId: string): Promise<WeekLogDomain | null> {
    return this.weekLogRepository.findActive(userId);
  }
}
