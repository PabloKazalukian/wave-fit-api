import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { isValidLocalDate } from 'src/common/utils/date.utils';
import type { IDayLogRepository } from '../../domain/interfaces/repositories/day-log.repository.interface';
import { DAY_LOG_REPOSITORY } from '../../domain/interfaces/repositories/day-log.repository.interface';
import { DayLogDomain } from '../../domain/entities/day-log.domain';
import { WorkoutSessionService } from '../../../workout-session/workout-session.service';
import { StatusWorkoutSessionEnum } from '../../../workout-session/schema/workout-session.schema';
import { RoutineDayService } from 'src/modules/routines/templates/routine-day/routine-day.service';

@Injectable()
export class AssignRoutineDayUseCase {
  constructor(
    @Inject(DAY_LOG_REPOSITORY)
    private readonly dayLogRepository: IDayLogRepository,
    @Inject(forwardRef(() => WorkoutSessionService))
    private readonly workoutSessionService: WorkoutSessionService,
    private readonly routineDayService: RoutineDayService,
  ) {}

  async execute(
    routineDayId: string,
    date: string,
    userId: string,
  ): Promise<DayLogDomain | null> {
    if (!isValidLocalDate(date)) {
      throw new BadRequestException(
        `date "${date}" must be in yyyy-MM-dd format`,
      );
    }

    const routineDay = await this.routineDayService.findOne(routineDayId);
    if (!routineDay) {
      throw new NotFoundException(
        `RoutineDay con ID "${routineDayId}" no encontrado`,
      );
    }

    const dayLog = await this.dayLogRepository.findActive(userId);
    if (!dayLog) {
      throw new BadRequestException('No hay un DayLog activo para el usuario');
    }

    const exercises =
      routineDay.exercises?.map((e: any) => ({
        exerciseId: (
          e.exercise?._id ||
          e.exercise?.id ||
          e.exercise ||
          e.exerciseId ||
          ''
        ).toString(),
        series: 0,
        sets: [],
      })) || [];

    let sessionId: string;

    if (dayLog.workoutSessionId) {
      const existingSession = await this.workoutSessionService.findOne(
        dayLog.workoutSessionId,
        userId,
      );
      if (existingSession) {
        existingSession.exercises = exercises as any;
        existingSession.routineDayId = new Types.ObjectId(routineDayId) as any;
        existingSession.dayLogId = new Types.ObjectId(dayLog.id) as any;
        existingSession.status = 'not_started';
        existingSession.edited = false;
        await (existingSession as any).save();
        sessionId = (existingSession as any)._id.toString();
      } else {
        const newSession = await this.workoutSessionService.create(
          {
            date,
            routineDayId,
            dayLogId: dayLog.id,
            exercises,
            status: StatusWorkoutSessionEnum.NOT_STARTED,
            notes: '',
            edited: false,
            deleted: false,
          } as any,
          userId,
        );
        sessionId = (newSession as any)._id.toString();
      }
    } else {
      const newSession = await this.workoutSessionService.create(
        {
          date,
          routineDayId,
          dayLogId: dayLog.id,
          exercises,
          status: StatusWorkoutSessionEnum.NOT_STARTED,
          notes: '',
          edited: false,
          deleted: false,
        } as any,
        userId,
      );
      sessionId = (newSession as any)._id.toString();
    }

    await this.dayLogRepository.updateStatus(dayLog.id, 'pending', sessionId);

    await this.dayLogRepository.findByIdAndUpdate(dayLog.id, {
      routineDayId: new Types.ObjectId(routineDayId),
    } as any);

    return this.dayLogRepository.findOne(dayLog.id, userId);
  }
}
