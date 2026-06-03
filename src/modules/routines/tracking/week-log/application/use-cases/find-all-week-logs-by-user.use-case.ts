import { Inject, Injectable } from '@nestjs/common';
import type { IWeekLogRepository } from '../../domain/interfaces/repositories/week-log.repository.interface';
import { WEEK_LOG_REPOSITORY } from '../../domain/interfaces/repositories/week-log.repository.interface';

@Injectable()
export class FindAllWeekLogsByUserUseCase {
  constructor(
    @Inject(WEEK_LOG_REPOSITORY)
    private readonly weekLogRepository: IWeekLogRepository,
  ) {}

  async execute(userId: string, limit: number = 5, offset: number = 0) {
    const trackings = await this.weekLogRepository.findAllByUser(
      userId,
      limit,
      offset,
    );
    // console.log('[findAllWeekLogsByUser] trackings:', { trackings });
    return trackings;
  }
}
