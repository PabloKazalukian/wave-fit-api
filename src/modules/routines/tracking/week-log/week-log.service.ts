import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateWeekLogInput } from './presentation/dto/create-week-log.input';
import { WeekLog } from './infrastructure/schemas/week-log.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  isDateSameLocalDate,
  utcToLocalDate,
  localDateToUtc,
  isValidLocalDate,
} from '../../../../common/utils/date.utils';
import { WorkoutSession } from '../workout-session/schema/workout-session.schema';
import { RoutineDayService } from '../../templates/routine-day/routine-day.service';
import {
  CreateWeekLogUseCase,
  FindAllWeekLogsByUserUseCase,
  FindOneWeekLogUseCase,
  FindActiveWeekLogUseCase,
  UpdateDayUseCase,
  UpdateWeekLogUseCase,
  UpdateDayWorkoutStatusUseCase,
  RemoveWorkoutSessionUseCase,
  RemoveWeekLogUseCase,
  RemoveExtraSessionUseCase,
  AssignRoutineDayUseCase,
} from './application/use-cases';
import { UpdateDayWorkoutStatusInput } from './presentation/dto/update-day-workout-status.input';
import {
  WeekLogDayDomain,
  WeekLogDomain,
} from './domain/entities/week-log.domain';
import {
  UpdateWeekLogDayUnifiedInput,
  UpdateWeekLogInput,
} from './presentation/dto/update-week-log.input';

export const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

@Injectable()
export class WeekLogService {
  constructor(
    @InjectModel(WeekLog.name) private weekLogModel: Model<WeekLog>,
    @InjectModel(WorkoutSession.name)
    private workoutSessionModel: Model<WorkoutSession>,
    private routineDayService: RoutineDayService,
    private readonly createWeekLogUseCase: CreateWeekLogUseCase,
    private readonly findAllWeekLogsByUserUseCase: FindAllWeekLogsByUserUseCase,
    private readonly findOneWeekLogUseCase: FindOneWeekLogUseCase,
    private readonly findActiveWeekLogUseCase: FindActiveWeekLogUseCase,
    private readonly updateDayUseCase: UpdateDayUseCase,
    private readonly updateWeekLogUseCase: UpdateWeekLogUseCase,
    private readonly updateDayWorkoutStatusUseCase: UpdateDayWorkoutStatusUseCase,
    private readonly removeWeekLogUseCase: RemoveWeekLogUseCase,
    private readonly removeWorkoutSessionUseCase: RemoveWorkoutSessionUseCase,
    private readonly removeExtraSessionUseCase: RemoveExtraSessionUseCase,
    private readonly assignRoutineDayUseCase: AssignRoutineDayUseCase,
  ) {}

  async create(
    createWeekLogInput: CreateWeekLogInput,
    userId: Types.ObjectId,
  ): Promise<WeekLogDomain | null> {
    return this.createWeekLogUseCase.execute(
      createWeekLogInput,
      userId.toString(),
    );
  }

  async findAllByUser(
    userId: string,
    limit: number = 5,
    offset: number = 0,
  ): Promise<WeekLogDomain[]> {
    console.log('[aca]', limit, offset);
    return this.findAllWeekLogsByUserUseCase.execute(userId, limit, offset);
  }

  async findOne(id: string, userId: string): Promise<WeekLogDomain | null> {
    const weekLog = await this.findOneWeekLogUseCase.execute(id, userId);
    if (!weekLog) {
      throw new NotFoundException('not found');
    }
    return weekLog;
  }

  async findActiveWeekLog(userId: string): Promise<WeekLogDomain | null> {
    return this.findActiveWeekLogUseCase.execute(userId);
  }

  //TODO: use-case
  async findOneDay(
    weekLogId: string,
    order: number,
    userId: string,
  ): Promise<WeekLogDayDomain> {
    const weekLog = await this.findOne(weekLogId, userId);
    if (!weekLog) {
      throw new NotFoundException(
        // `Week log con ID "${weekLogId}" no encontrado`,
        'not found',
      );
    }
    const day = weekLog.days.find((d) => d.order === order);
    if (!day) {
      throw new NotFoundException(`Día con orden ${order} no encontrado`);
    }
    return day;
  }

  async updateDay(input: UpdateWeekLogDayUnifiedInput, userId: string) {
    return this.updateDayUseCase.execute(input, userId);
  }

  async updateWeekLog(input: UpdateWeekLogInput, userId: string) {
    return this.updateWeekLogUseCase.execute(input, userId);
  }

  // TODO: use-case
  async syncDaysWithSessions(
    weekLogId: string,
    userId: string,
  ): Promise<WeekLogDomain> {
    const weekLog = await this.weekLogModel
      .findOne({ _id: weekLogId, userId: new Types.ObjectId(userId) })
      .exec();
    if (!weekLog) throw new NotFoundException('WeekLog not found');

    const sessions = await this.workoutSessionModel.find({
      weekLogId,
      userId,
    });

    let updated = false;

    for (const day of weekLog.days) {
      // Comparar fechas UTC de Mongo con las sesiones usando la misma timezone
      const session = sessions.find((s) =>
        isDateSameLocalDate(
          s.date,
          utcToLocalDate(day.date, DEFAULT_TIMEZONE),
          DEFAULT_TIMEZONE,
        ),
      );

      if (session) {
        day.workoutSessionId = new Types.ObjectId(session._id as any);
        day.status = 'complete';
        updated = true;
      }
    }

    if (updated) {
      await weekLog.save();
    }

    const result = await this.findOne(weekLogId, userId);
    if (!result) {
      throw new NotFoundException('WeekLog not found');
    }
    return result;
  }

  async remove(id: string, userId: string): Promise<WeekLogDomain | null> {
    return this.removeWeekLogUseCase.execute(id, userId);
  }

  async removeWorkoutSessionFromDay(
    workoutSessionId: string,
    userId: string,
  ): Promise<WeekLogDayDomain> {
    return this.removeWorkoutSessionUseCase.execute(workoutSessionId, userId);
  }

  async assignRoutineToDay(
    routineDayId: string,
    date: string, // LocalDate "yyyy-MM-dd"
    userId: string,
    timezone: string = DEFAULT_TIMEZONE,
  ): Promise<WeekLogDayDomain> {
    try {
      return this.assignRoutineDayUseCase.execute(
        routineDayId,
        date,
        userId,
        timezone,
      );
    } catch (error) {
      console.error('[assignRoutineToDay] Error:', error);
      throw error;
    }
  }

  async removeExtraSessionFromDay(
    extraSessionId: string,
    userId: string,
    date: string, // LocalDate "yyyy-MM-dd"
    timezone: string = DEFAULT_TIMEZONE,
  ): Promise<WeekLogDayDomain> {
    return this.removeExtraSessionUseCase.execute(
      extraSessionId,
      userId,
      date,
      timezone,
    );
  }

  async updateDayWorkoutStatus(
    input: UpdateDayWorkoutStatusInput & { timezone?: string },
    userId: string,
  ): Promise<WeekLogDayDomain> {
    const timezone = (input as any).timezone ?? DEFAULT_TIMEZONE;

    return this.updateDayWorkoutStatusUseCase.execute(input, timezone, userId);
  }
}
