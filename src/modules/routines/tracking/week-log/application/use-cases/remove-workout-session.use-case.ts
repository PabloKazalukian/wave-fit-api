import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DEFAULT_TIMEZONE, WeekLogService } from '../../week-log.service';
import { WEEK_LOG_REPOSITORY } from '../../domain/interfaces/repositories/week-log.repository.interface';
import {
  WeekLogDayDomain,
  WeekLogDomain,
} from '../../domain/entities/week-log.domain';
import type { IWeekLogRepository } from '../../domain/interfaces/repositories/week-log.repository.interface';
import { WeekLogValidator } from '../validators/week-log.validator';
import {
  isDateSameLocalDate,
  isValidLocalDate,
} from 'src/common/utils/date.utils';
import { WorkoutSessionService } from '../../../workout-session/workout-session.service';

@Injectable()
export class RemoveWorkoutSessionUseCase {
  constructor(
    private readonly validator: WeekLogValidator,

    @Inject(forwardRef(() => WorkoutSessionService))
    private readonly workoutSessionService: WorkoutSessionService,
    @Inject(forwardRef(() => WeekLogService))
    private readonly weekLogService: WeekLogService,
    @Inject(WEEK_LOG_REPOSITORY)
    private readonly weekLogRepository: IWeekLogRepository,
  ) {}

  async execute(
    workoutSessionId: string,
    userId: string,
  ): Promise<WeekLogDayDomain> {
    const weekLog = await this.weekLogRepository.findActive(userId);

    if (!weekLog) {
      throw new NotFoundException(
        `No se encontró un WeekLog con el workoutSessionId "${workoutSessionId}"`,
      );
    }

    this.validator.validateOwnership(weekLog, userId);

    const day = weekLog.days.find(
      (d) =>
        d.workoutSessionId &&
        d.workoutSessionId.toString() === workoutSessionId,
    );

    if (!day) {
      throw new NotFoundException(
        `No se encontró un día con el workoutSessionId "${workoutSessionId}"`,
      );
    }

    day.workoutSessionId = null;
    day.status = 'pending';

    await this.weekLogRepository.updateDayField(
      weekLog.id.toString(),
      day.order,
      {
        workoutSessionId: null,
        status: 'pending',
      },
    );

    await this.workoutSessionService.remove(workoutSessionId, userId);

    return this.weekLogService.findOneDay(
      weekLog.id.toString(),
      day.order,
      userId,
    );
  }
}
