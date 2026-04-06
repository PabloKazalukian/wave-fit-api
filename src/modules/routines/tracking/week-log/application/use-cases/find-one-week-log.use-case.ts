import { Inject, Injectable } from '@nestjs/common';
import type { IWeekLogRepository } from '../../domain/interfaces/repositories/week-log.repository.interface';
import { WEEK_LOG_REPOSITORY } from '../../domain/interfaces/repositories/week-log.repository.interface';

@Injectable()
export class FindOneWeekLogUseCase {
  constructor(
    @Inject(WEEK_LOG_REPOSITORY)
    private readonly weekLogRepository: IWeekLogRepository,
  ) {}

  async execute(id: string, userId: string) {
    return this.weekLogRepository.findOne(id, userId);
  }
}
