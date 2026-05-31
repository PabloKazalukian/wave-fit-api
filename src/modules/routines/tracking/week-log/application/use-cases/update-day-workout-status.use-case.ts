import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { WeekLogDayDomain } from '../../domain/entities/week-log.domain';
import {
  isDateSameLocalDate,
  isValidLocalDate,
  localDateToUtc,
} from 'src/common/utils/date.utils';
import { UpdateDayWorkoutStatusInput } from '../../presentation/dto/update-day-workout-status.input';
import { WorkoutSessionService } from '../../../workout-session/workout-session.service';
import { Types } from 'mongoose';
import { StatusWorkoutSessionEnum } from '../../../workout-session/schema/workout-session.schema';
import { WeekLogService } from '../../week-log.service';
import type { IWeekLogRepository } from '../../domain/interfaces/repositories/week-log.repository.interface';
import { WEEK_LOG_REPOSITORY } from '../../domain/interfaces/repositories/week-log.repository.interface';

@Injectable()
export class UpdateDayWorkoutStatusUseCase {
  constructor(
    @Inject(forwardRef(() => WorkoutSessionService))
    private readonly workoutSessionService: WorkoutSessionService,
    @Inject(forwardRef(() => WeekLogService))
    private readonly weekLogService: WeekLogService,
    @Inject(WEEK_LOG_REPOSITORY)
    private readonly weekLogRepository: IWeekLogRepository,
  ) {}

  async execute(
    input: UpdateDayWorkoutStatusInput,
    timezone: string,
    userId: string,
  ): Promise<WeekLogDayDomain> {
    if (!isValidLocalDate(input.date)) {
      throw new BadRequestException(
        `date "${input.date}" must be in yyyy-MM-dd format`,
      );
    }

    const weekLog = await this.weekLogRepository.findActive(userId);
    if (!weekLog) throw new NotFoundException('No active week log found');

    // ✅ Comparar LocalDate con la fecha del día en Mongo
    const day = weekLog.days.find((d: any) =>
      isDateSameLocalDate(d.date, input.date, timezone),
    );

    if (!day) throw new NotFoundException('Day not found in week log');

    if (input.isRest) {
      if (day.workoutSessionId) {
        await this.workoutSessionService.remove(
          day.workoutSessionId.toString(),
          userId,
        );
      }

      day.isRest = true;
      day.status = 'skipped';
      day.workoutSessionId = null;
    } else {
      day.isRest = false;
      day.status = 'pending';

      if (!day.workoutSessionId) {
        const newSession = await this.workoutSessionService.create(
          {
            date: localDateToUtc(input.date, timezone), // ✅ LocalDate → UTC
            status: StatusWorkoutSessionEnum.NOT_STARTED,
            exercises: [],
            timezone,
            weekLogId: weekLog.id,
          },
          userId,
        );
        day.workoutSessionId = new Types.ObjectId(newSession.id);
      } else {
        await this.workoutSessionService.update(
          day.workoutSessionId.toString(),
          {
            status: StatusWorkoutSessionEnum.NOT_STARTED,
          },
          userId,
        );
      }
    }

    await this.weekLogRepository.updateDayStatus(weekLog.id, day.order, {
      isRest: day.isRest,
      status: day.status,
      workoutSessionId: day.workoutSessionId,
    });

    return this.weekLogService.findOneDay(weekLog.id, day.order, userId);
  }
}
