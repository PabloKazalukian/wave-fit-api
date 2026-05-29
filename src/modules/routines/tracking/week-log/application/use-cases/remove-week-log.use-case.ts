import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { WeekLogService } from '../../week-log.service';
import { WEEK_LOG_REPOSITORY } from '../../domain/interfaces/repositories/week-log.repository.interface';
import { WeekLogDomain } from '../../domain/entities/week-log.domain';
import type { IWeekLogRepository } from '../../domain/interfaces/repositories/week-log.repository.interface';

@Injectable()
export class RemoveWeekLogUseCase {
  constructor(
    @Inject(forwardRef(() => WeekLogService))
    private readonly weekLogService: WeekLogService,
    @Inject(WEEK_LOG_REPOSITORY)
    private readonly weekLogRepository: IWeekLogRepository,
  ) {}

  async execute(id: string, userId: string): Promise<WeekLogDomain | null> {
    await this.weekLogService.findOne(id, userId);

    const updated = await this.weekLogRepository.findByIdAndSoftDelete(id);

    if (!updated) return null;
    return updated;
  }
}
