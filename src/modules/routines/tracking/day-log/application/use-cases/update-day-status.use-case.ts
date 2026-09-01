import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { IDayLogRepository } from '../../domain/interfaces/repositories/day-log.repository.interface';
import { DAY_LOG_REPOSITORY } from '../../domain/interfaces/repositories/day-log.repository.interface';
import { DayLogDomain } from '../../domain/entities/day-log.domain';
import { isValidLocalDate } from 'src/common/utils/date.utils';
import { WorkoutSessionService } from '../../../workout-session/workout-session.service';
import { StatusWorkoutSessionEnum } from '../../../workout-session/schema/workout-session.schema';

@Injectable()
export class UpdateDayStatusUseCase {
  constructor(
    @Inject(DAY_LOG_REPOSITORY)
    private readonly dayLogRepository: IDayLogRepository,
    @Inject(forwardRef(() => WorkoutSessionService))
    private readonly workoutSessionService: WorkoutSessionService,
  ) {}

  async execute(
    date: string,
    isRest: boolean,
    userId: string,
  ): Promise<DayLogDomain | null> {
    if (!isValidLocalDate(date)) {
      throw new Error(`date "${date}" must be in yyyy-MM-dd format`);
    }

    const dayLog = await this.dayLogRepository.findActive(userId);
    if (!dayLog) throw new NotFoundException('No active day-log found');

    if (isRest) {
      if (dayLog.workoutSessionId) {
        await this.workoutSessionService.remove(
          dayLog.workoutSessionId.toString(),
          userId,
        );
      }
      dayLog.status = 'skipped';
      dayLog.workoutSessionId = null;
    } else {
      dayLog.status = 'pending';
      if (!dayLog.workoutSessionId) {
        const newSession = await this.workoutSessionService.create(
          {
            date,
            status: StatusWorkoutSessionEnum.NOT_STARTED,
            exercises: [],
            timezone: undefined,
          } as any,
          userId,
        );
        dayLog.workoutSessionId = (newSession as any)._id.toString();
      } else {
        await this.workoutSessionService.update(
          dayLog.workoutSessionId.toString(),
          {
            status: StatusWorkoutSessionEnum.NOT_STARTED,
          },
          userId,
        );
      }
    }

    await this.dayLogRepository.updateStatus(
      dayLog.id,
      dayLog.status,
      dayLog.workoutSessionId,
    );

    return this.dayLogRepository.findOne(dayLog.id, userId);
  }
}
