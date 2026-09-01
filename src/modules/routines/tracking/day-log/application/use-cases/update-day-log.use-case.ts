import { Inject, Injectable } from '@nestjs/common';
import type { IDayLogRepository } from '../../domain/interfaces/repositories/day-log.repository.interface';
import { DAY_LOG_REPOSITORY } from '../../domain/interfaces/repositories/day-log.repository.interface';
import { DayLogDomain } from '../../domain/entities/day-log.domain';
import { UpdateDayLogInput } from '../../presentation/dto/update-day-log.input';
import { DayLogValidator } from '../validators/day-log.validator';

@Injectable()
export class UpdateDayLogUseCase {
  constructor(
    @Inject(DAY_LOG_REPOSITORY)
    private readonly dayLogRepository: IDayLogRepository,
    private readonly validator: DayLogValidator,
  ) {}

  async execute(
    input: UpdateDayLogInput,
    userId: string,
  ): Promise<DayLogDomain | null> {
    const { id, active, completed, notes } = input;

    const dayLog = await this.dayLogRepository.findOne(id, userId);
    if (!dayLog) {
      throw new Error(`DayLog con ID "${id}" no encontrado`);
    }
    this.validator.validateOwnership(dayLog, userId);

    const update: any = {};

    if (notes !== undefined) update.notes = notes;
    if (completed === true) {
      // Regla: completed = true → active = false forzado
      update.completed = true;
      update.active = false;
    } else {
      if (completed !== undefined) update.completed = completed;
      if (active !== undefined) update.active = active;
    }

    if (Object.keys(update).length === 0) {
      return dayLog;
    }

    return this.dayLogRepository.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });
  }
}
