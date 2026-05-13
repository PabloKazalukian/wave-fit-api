import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { CreateWeekLogInput } from './presentation/dto/create-week-log.input';
import { WeekLog } from './infrastructure/schemas/week-log.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, UpdateQuery } from 'mongoose';
import {
  isDateSameLocalDate,
  utcToLocalDate,
  localDateToUtc,
  isValidLocalDate,
  nowUtc,
} from '../../../../common/utils/date.utils';
import { WorkoutSession } from '../workout-session/schema/workout-session.schema';
import { RoutineDayService } from '../../templates/routine-day/routine-day.service';
import { WeekLogValidator } from './application/validators/week-log.validator';
import {
  CreateWeekLogUseCase,
  FindAllWeekLogsByUserUseCase,
  UpdateDayUseCase,
  UpdateWeekLogUseCase,
} from './application/use-cases';
import { UpdateDayWorkoutStatusInput } from './presentation/dto/update-day-workout-status.input';
import { WeekLogDomain } from './domain/entities/week-log.domain';
import { WorkoutSessionService } from '../workout-session/workout-session.service';
import {
  UpdateWeekLogDayUnifiedInput,
  UpdateWeekLogInput,
} from './presentation/dto/update-week-log.input';

const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

@Injectable()
export class WeekLogService {
  constructor(
    @InjectModel(WeekLog.name) private weekLogModel: Model<WeekLog>,
    @InjectModel(WorkoutSession.name)
    private workoutSessionModel: Model<WorkoutSession>,
    private readonly validator: WeekLogValidator,
    private routineDayService: RoutineDayService,
    private readonly createWeekLogUseCase: CreateWeekLogUseCase,
    private readonly findAllWeekLogsByUserUseCase: FindAllWeekLogsByUserUseCase,
    private readonly updateDayUseCase: UpdateDayUseCase,
    private readonly updateWeekLogUseCase: UpdateWeekLogUseCase,
    @Inject(forwardRef(() => WorkoutSessionService))
    private readonly workoutSessionService: WorkoutSessionService,
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
  ): Promise<any[]> {
    return this.findAllWeekLogsByUserUseCase.execute(userId, limit, offset);
  }

  async findOne(id: string, userId: string): Promise<any> {
    const weekLog = await this.weekLogModel
      .findOne({ _id: id, userId, deleted: { $ne: true } })
      .populate('days.workoutSessionId')
      .exec();

    if (!weekLog) {
      throw new NotFoundException(`not found`);
    }

    return this.mapWeekLog(weekLog);
  }

  async findActiveWeekLog(userId: string): Promise<any | null> {
    const weekLog = await this.weekLogModel
      .findOne({ userId, active: true })
      .populate('days.workoutSessionId')
      .populate('days.extraSessionIds')
      .exec();

    if (!weekLog) return null;

    return this.mapWeekLog(weekLog);
  }

  private mapWeekLog(weekLog: any): any {
    const weekLogObj = weekLog.toObject ? weekLog.toObject() : weekLog;

    return {
      ...weekLogObj,
      id: weekLogObj._id.toString(),
      days: weekLogObj.days.map((day) => this.mapDay(day)),
    };
  }

  private mapDay(day: any): any {
    const session = day.workoutSessionId;
    const extraSessions = day.extraSessionIds;
    return {
      ...day,
      workoutSessionId: session?._id ? session._id.toString() : session,
      extraSessionIds:
        extraSessions?.map((es: any) => (es?._id ? es._id.toString() : es)) ||
        [],
      exercises: session?.exercises || [],
    };
  }

  async findOneDay(
    weekLogId: string,
    order: number,
    userId: string,
  ): Promise<any> {
    const weekLog = await this.weekLogModel
      .findOne({ _id: weekLogId, userId, deleted: { $ne: true } })
      .populate('days.workoutSessionId')
      .populate('days.extraSessionIds')
      .exec();

    if (!weekLog) {
      throw new NotFoundException(
        `Week log con ID "${weekLogId}" no encontrado`,
      );
    }

    const day = weekLog.days.find((d) => d.order === order);
    if (!day) {
      throw new NotFoundException(`Día con orden ${order} no encontrado`);
    }

    return this.mapDay((day as any).toObject ? (day as any).toObject() : day);
  }

  async updateDay(input: UpdateWeekLogDayUnifiedInput, userId: string) {
    return this.updateDayUseCase.execute(input, userId);
  }

  async updateWeekLog(input: UpdateWeekLogInput, userId: string) {
    return this.updateWeekLogUseCase.execute(input, userId);
  }

  async findByIdAndUpdate(
    id: string,
    updateQuery: UpdateQuery<WeekLog>,
    options?: { new?: boolean; runValidators?: boolean },
  ): Promise<WeekLog> {
    const weekLog = await this.weekLogModel
      .findByIdAndUpdate(id, updateQuery, {
        new: options?.new ?? true,
        runValidators: options?.runValidators ?? true,
      })
      .lean();

    if (!weekLog) {
      throw new NotFoundException(`WeekLog with ID ${id} not found`);
    }

    return this.mapWeekLog(weekLog);
  }

  async syncDaysWithSessions(weekLogId: string, userId: string) {
    const weekLog = await this.weekLogModel
      .findOne({ _id: weekLogId, userId })
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

    return this.findOne(weekLogId, userId);
  }

  async remove(id: string, userId: string) {
    const existing = await this.weekLogModel.findOne({
      _id: id,
      userId,
      deleted: { $ne: true },
    });
    if (!existing) {
      throw new NotFoundException(`Week Log with ID "${id}" not found`);
    }

    const updated = await this.weekLogModel
      .findByIdAndUpdate(
        id,
        {
          deleted: true,
          deletedAt: nowUtc(),
        },
        { new: true },
      )
      .exec();

    return updated;
  }

  async removeWorkoutSessionFromDay(
    workoutSessionId: string,
    userId: string,
  ): Promise<any> {
    const weekLog = await this.weekLogModel
      .findOne({ userId, active: true })
      .exec();

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

    await weekLog.save();

    await this.workoutSessionService.remove(workoutSessionId, userId);

    return this.findOneDay(weekLog._id.toString(), day.order, userId);
  }

  async assignRoutineToDay(
    routineDayId: string,
    date: string, // LocalDate "yyyy-MM-dd"
    userId: string,
    timezone: string = DEFAULT_TIMEZONE,
  ): Promise<any> {
    try {
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

      const weekLog = await this.findActiveWeekLog(userId);
      if (!weekLog) {
        throw new BadRequestException(
          'No hay un WeekLog activo para el usuario',
        );
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

      let sessionId: Types.ObjectId;

      if (dayToUpdate.workoutSessionId) {
        const existingSession = await this.workoutSessionModel
          .findById(dayToUpdate.workoutSessionId)
          .exec();

        if (existingSession) {
          existingSession.exercises = exercises;
          existingSession.routineDayId = routineDayId;
          existingSession.status = 'not_started';
          existingSession.edited = false;
          await existingSession.save();
          sessionId = existingSession._id;
        } else {
          const newSession = await this.workoutSessionModel.create({
            userId: new Types.ObjectId(userId),
            weekLogId: weekLog._id.toString(),
            date: localDateToUtc(date, timezone), // ✅ LocalDate → UTC
            routineDayId,
            exercises,
            status: 'not_started',
            notes: '',
            edited: false,
            deleted: false,
          });
          sessionId = newSession._id;
        }
      } else {
        const newSession = await this.workoutSessionModel.create({
          userId: new Types.ObjectId(userId),
          weekLogId: weekLog._id.toString(),
          date: localDateToUtc(date, timezone), // ✅ LocalDate → UTC
          routineDayId,
          exercises,
          status: 'not_started',
          notes: '',
          edited: false,
          deleted: false,
        });
        sessionId = newSession._id;
      }

      await this.weekLogModel.updateOne(
        { _id: weekLog._id, 'days.order': dayToUpdate.order },
        {
          $set: {
            'days.$.workoutSessionId': sessionId,
            'days.$.isRest': false,
            'days.$.status': 'pending',
          },
        },
      );

      return this.findOneDay(weekLog._id.toString(), dayToUpdate.order, userId);
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
  ): Promise<any> {
    const weekLog = await this.weekLogModel
      .findOne({ userId, active: true })
      .exec();

    if (!weekLog) {
      throw new NotFoundException(
        `No se encontró un WeekLog con el extraSessionId "${extraSessionId}"`,
      );
    }

    this.validator.validateOwnership(weekLog, userId);

    if (!isValidLocalDate(date)) {
      throw new BadRequestException(
        `date "${date}" must be in yyyy-MM-dd format`,
      );
    }

    // ✅ Comparar LocalDate con fecha del día en Mongo
    const day = weekLog.days.find((d) =>
      isDateSameLocalDate(d.date, date, timezone),
    );

    if (!day) {
      throw new NotFoundException(
        `No se encontró un día con fecha "${date}" en el WeekLog activo`,
      );
    }

    day.extraSessionIds = day.extraSessionIds.filter(
      (id) => id.toString() !== extraSessionId,
    );

    await weekLog.save();

    return this.findOneDay(weekLog._id.toString(), day.order, userId);
  }

  async updateDayWorkoutStatus(
    input: UpdateDayWorkoutStatusInput & { timezone?: string },
    userId: string,
  ): Promise<any> {
    const timezone = (input as any).timezone ?? DEFAULT_TIMEZONE;

    if (!isValidLocalDate(input.date)) {
      throw new BadRequestException(
        `date "${input.date}" must be in yyyy-MM-dd format`,
      );
    }

    const weekLog = await this.findActiveWeekLog(userId);
    if (!weekLog) throw new NotFoundException('No active week log found');

    // ✅ Comparar LocalDate con la fecha del día en Mongo
    const day = weekLog.days.find((d: any) =>
      isDateSameLocalDate(d.date, input.date, timezone),
    );

    if (!day) throw new NotFoundException('Day not found in week log');

    if (input.isRest) {
      if (day.workoutSessionId) {
        await this.workoutSessionModel
          .findByIdAndDelete(day.workoutSessionId)
          .exec();
      }

      day.isRest = true;
      day.status = 'skipped';
      day.workoutSessionId = null;
    } else {
      day.isRest = false;
      day.status = 'pending';

      if (!day.workoutSessionId) {
        const newSession = await this.workoutSessionModel.create({
          userId,
          date: localDateToUtc(input.date, timezone), // ✅ LocalDate → UTC
          status: 'not_started',
          exercises: [],
        });
        day.workoutSessionId = newSession._id;
      } else {
        const session = await this.workoutSessionModel
          .findById(day.workoutSessionId)
          .exec();
        if (session) {
          session.status = 'not_started';
          await session.save();
        }
      }
    }

    await this.weekLogModel.updateOne(
      { _id: weekLog.id, 'days.order': day.order },
      {
        $set: {
          'days.$.isRest': day.isRest,
          'days.$.status': day.status,
          'days.$.workoutSessionId': day.workoutSessionId,
        },
      },
    );

    return this.findOneDay(weekLog.id, day.order, userId);
  }
}
