import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DEFAULT_TIMEZONE, WeekLogService } from '../../week-log.service';
import { WEEK_LOG_REPOSITORY } from '../../domain/interfaces/repositories/week-log.repository.interface';
import { WeekLogDayDomain } from '../../domain/entities/week-log.domain';
import type { IWeekLogRepository } from '../../domain/interfaces/repositories/week-log.repository.interface';
import {
  isValidLocalDate,
  isDateSameLocalDate,
  localDateToUtc,
} from 'src/common/utils/date.utils';
import { WeekLogValidator } from '../validators/week-log.validator';
import { RoutineDayService } from 'src/modules/routines/templates/routine-day/routine-day.service';
import { Types } from 'mongoose';
import { WorkoutSessionService } from '../../../workout-session/workout-session.service';
import { StatusWorkoutSessionEnum } from '../../../workout-session/schema/workout-session.schema';

@Injectable()
export class AssignRoutineDayUseCase {
  constructor(
    private readonly validator: WeekLogValidator,

    @Inject(forwardRef(() => WeekLogService))
    private readonly weekLogService: WeekLogService,
    @Inject(forwardRef(() => WorkoutSessionService))
    private readonly workoutSessionService: WorkoutSessionService,
    @Inject(WEEK_LOG_REPOSITORY)
    private readonly weekLogRepository: IWeekLogRepository,
    private readonly routineDayService: RoutineDayService,
  ) {}

  async execute(
    routineDayId: string,
    date: string, // LocalDate "yyyy-MM-dd"
    userId: string,
    timezone: string = DEFAULT_TIMEZONE,
  ): Promise<WeekLogDayDomain> {
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

    const weekLog = await this.weekLogService.findActiveWeekLog(userId);
    if (!weekLog) {
      throw new BadRequestException('No hay un WeekLog activo para el usuario');
    }

    // ✅ Comparar LocalDate string con la fecha de cada día (convertida desde UTC)
    const dayToUpdate = weekLog.days.find((d) =>
      isDateSameLocalDate(d.date, date, timezone),
    );

    if (!dayToUpdate) {
      throw new BadRequestException(
        `La fecha ${date} no pertenece al WeekLog activo`,
      );
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

    if (dayToUpdate.workoutSessionId) {
      const existingSession = await this.workoutSessionService.findOne(
        dayToUpdate.workoutSessionId,
        userId,
      );

      if (existingSession) {
        existingSession.exercises = exercises;
        existingSession.routineDayId = routineDayId
          ? new Types.ObjectId(routineDayId)
          : undefined;
        existingSession.status = 'not_started';
        existingSession.edited = false;
        await existingSession.save();
        sessionId = existingSession.id;
      } else {
        const newSession = await this.workoutSessionService.create(
          {
            weekLogId: weekLog.id,
            date: localDateToUtc(date, timezone),
            routineDayId,
            exercises,
            status: StatusWorkoutSessionEnum.NOT_STARTED,
            notes: '',
            edited: false,
            deleted: false,
          },
          userId,
        );
        sessionId = newSession.id;
      }
    } else {
      const newSession = await this.workoutSessionService.create(
        {
          weekLogId: weekLog.id,
          date: localDateToUtc(date, timezone),
          routineDayId,
          exercises,
          status: StatusWorkoutSessionEnum.NOT_STARTED,
          notes: '',
          edited: false,
          deleted: false,
        },
        userId,
      );
      sessionId = newSession.id;
    }

    await this.weekLogRepository.updateDayField(weekLog.id, dayToUpdate.order, {
      workoutSessionId: sessionId,
      isRest: false,
      status: 'pending',
    });

    const updatedWeekLog = await this.weekLogRepository.findOne(
      weekLog.id,
      userId,
    );
    const updatedDay = updatedWeekLog?.days.find(
      (d) => d.order === dayToUpdate.order,
    );
    if (!updatedDay) throw new NotFoundException('Day not found after update');
    return updatedDay;
  }
}
