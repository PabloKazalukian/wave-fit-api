import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { IDayLogRepository } from '../../domain/interfaces/repositories/day-log.repository.interface';
import { DAY_LOG_REPOSITORY } from '../../domain/interfaces/repositories/day-log.repository.interface';
import { DayLogDomain } from '../../domain/entities/day-log.domain';
import { WorkoutSessionService } from '../../../workout-session/workout-session.service';

@Injectable()
export class RemoveWorkoutSessionUseCase {
  constructor(
    @Inject(DAY_LOG_REPOSITORY)
    private readonly dayLogRepository: IDayLogRepository,
    @Inject(forwardRef(() => WorkoutSessionService))
    private readonly workoutSessionService: WorkoutSessionService,
  ) {}

  async execute(
    workoutSessionId: string,
    userId: string,
  ): Promise<DayLogDomain | null> {
    const dayLog = await this.dayLogRepository.findActive(userId);
    if (!dayLog) {
      throw new NotFoundException(
        `No se encontró un DayLog con el workoutSessionId "${workoutSessionId}"`,
      );
    }

    if (
      !dayLog.workoutSessionId ||
      dayLog.workoutSessionId.toString() !== workoutSessionId
    ) {
      throw new NotFoundException(
        `No se encontró un DayLog con el workoutSessionId "${workoutSessionId}"`,
      );
    }

    dayLog.workoutSessionId = null;
    dayLog.status = 'pending';

    await this.dayLogRepository.updateStatus(dayLog.id, 'pending', null);

    await this.workoutSessionService.remove(workoutSessionId, userId);

    return this.dayLogRepository.findOne(dayLog.id, userId);
  }
}
