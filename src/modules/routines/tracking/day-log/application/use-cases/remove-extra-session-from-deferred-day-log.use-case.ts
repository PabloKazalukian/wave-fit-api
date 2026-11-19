import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import type { IDayLogRepository } from '../../domain/interfaces/repositories/day-log.repository.interface';
import { DAY_LOG_REPOSITORY } from '../../domain/interfaces/repositories/day-log.repository.interface';
import { DayLogDomain } from '../../domain/entities/day-log.domain';
import { ExtraSessionService } from '../../../extra-session/extra-session.service';

@Injectable()
export class RemoveExtraSessionFromDeferredDayLogUseCase {
  constructor(
    @Inject(DAY_LOG_REPOSITORY)
    private readonly dayLogRepository: IDayLogRepository,
    private readonly extraSessionService: ExtraSessionService,
  ) {}

  async execute(
    extraSessionId: string,
    userId: string,
  ): Promise<DayLogDomain | null> {
    const dayLog = await this.dayLogRepository.findByExtraSessionId(
      extraSessionId,
      userId,
    );

    if (!dayLog) {
      throw new NotFoundException(
        `No se encontró un DayLog con el extraSessionId "${extraSessionId}"`,
      );
    }

    const updatedExtraSessionIds = dayLog.extraSessionIds.filter(
      (id) => id.toString() !== extraSessionId,
    );

    await this.dayLogRepository.findByIdAndUpdate(dayLog.id, {
      extraSessionIds: updatedExtraSessionIds.map(
        (id) => new Types.ObjectId(id),
      ),
    } as any);

    await this.extraSessionService.remove(extraSessionId, userId);

    return this.dayLogRepository.findOne(dayLog.id, userId);
  }
}
