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
  compareSameDay,
  ensureDate,
  parseLocalDate,
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
import { WeekLogDomain } from './domain/entities/week-log.domain';
import { WorkoutSessionService } from '../workout-session/workout-session.service';
import {
  UpdateWeekLogDayUnifiedInput,
  UpdateWeekLogInput,
} from './presentation/dto/update-week-log.input';

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
    const weekLogs = await this.findAllWeekLogsByUserUseCase.execute(
      userId,
      limit,
      offset,
    );

    return weekLogs;
  }

  async findOne(id: string, userId: string): Promise<any> {
    const weekLog = await this.weekLogModel
      .findOne({ _id: id, userId })
      .populate('days.workoutSessionId')
      .exec();

    if (!weekLog) {
      throw new NotFoundException(`Week log con ID "${id}" no encontrado`);
    }

    const result = this.mapWeekLog(weekLog);
    return result;
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

    const mapped = {
      ...weekLogObj,
      id: weekLogObj._id.toString(),
      days: weekLogObj.days.map((day) => this.mapDay(day)),
    };

    return mapped;
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
      .findOne({ _id: weekLogId, userId })
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

  /**
   * Mutation unificada: crea/actualiza WS y ES en un day del WL.
   * Delega toda la lógica al UpdateDayUseCase.
   */
  async updateDay(input: UpdateWeekLogDayUnifiedInput, userId: string) {
    return this.updateDayUseCase.execute(input, userId);
  }

  /**
   * Mutation general del WeekLog.
   * - Actualiza metadata (notes, startDate, endDate)
   * - completed=true → active=false (forzado)
   * - active=true → desactiva otros WL del usuario
   * - days opcionales: usa la misma lógica de WS/ES
   */
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
      const session = sessions.find((s) => compareSameDay(s.date, day.date));

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

  remove(id: string) {
    return this.weekLogModel.deleteOne({ _id: id }).exec();
  }

  async removeWorkoutSessionFromDay(
    workoutSessionId: string,
    userId: string,
  ): Promise<any> {
    const weekLog = await this.weekLogModel
      .findOne({
        userId: userId,
        active: true,
        // 'days.workoutSessionId': new Types.ObjectId(workoutSessionId),
      })
      .exec();

    if (!weekLog) {
      throw new NotFoundException(
        `No se encontró un WeekLlog con el workoutSessionId "${workoutSessionId}"`,
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
    date: string,
    userId: string,
  ): Promise<any> {
    try {
      // 1. Validar que existe el routineDay
      const routineDay = await this.routineDayService.findOne(routineDayId);
      if (!routineDay) {
        throw new NotFoundException(
          `RoutineDay con ID "${routineDayId}" no encontrado`,
        );
      }

      // 2. Obtener weekLog activo
      const weekLog = await this.findActiveWeekLog(userId);
      if (!weekLog) {
        throw new BadRequestException(
          'No hay un WeekLog activo para el usuario',
        );
      }

      // 3. Parsear fecha
      const searchDate = parseLocalDate(date);

      // 4. Encontrar el día en el weekLog
      const dayToUpdate = weekLog.days.find((d) =>
        compareSameDay(d.date, searchDate),
      );

      if (!dayToUpdate) {
        throw new BadRequestException(
          `La fecha ${date} no pertenece al WeekLog activo`,
        );
      }

      // 5. Preparar exercises para el workout-session
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

      // 6. Verificar si ya existe un workout-session para este día

      if (dayToUpdate.workoutSessionId) {
        // Ya existe, actualizarlo
        const existingSession = await this.workoutSessionModel
          .findById(dayToUpdate.workoutSessionId)
          .exec();

        if (existingSession) {
          existingSession.exercises = exercises;
          existingSession.routineDayId = routineDayId;
          existingSession.status = 'not_started'; // Resetear a not_started
          existingSession.edited = false; // Resetear flag de editado
          await existingSession.save();
          sessionId = existingSession._id;
        } else {
          // El ID existe pero el documento no, crear uno nuevo
          const newSession = await this.workoutSessionModel.create({
            userId: new Types.ObjectId(userId),
            weekLogId: weekLog._id.toString(),
            date: searchDate,
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
        // No existe, crear nuevo workout-session
        const newSession = await this.workoutSessionModel.create({
          userId: new Types.ObjectId(userId),
          weekLogId: weekLog._id.toString(),
          date: searchDate,
          routineDayId,
          exercises,
          status: 'not_started',
          notes: '',
          edited: false,
          deleted: false,
        });
        sessionId = newSession._id;
      }

      // 7. Actualizar el día en el weekLog
      await this.weekLogModel.updateOne(
        { _id: weekLog._id, 'days.order': dayToUpdate.order },
        {
          $set: {
            'days.$.workoutSessionId': sessionId,
            'days.$.isRest': false, // Ya no es día de descanso
            'days.$.status': 'pending', // Status del day = pending (workout asignado pero no completado)
          },
        },
      );

      // 8. Retornar el día actualizado
      return this.findOneDay(weekLog._id.toString(), dayToUpdate.order, userId);
    } catch (error) {
      console.error('[assignRoutineToDay] Error:', error);
      throw error;
    }
  }

  async removeExtraSessionFromDay(
    extraSessionId: string,
    userId: string,
    date: string,
  ): Promise<any> {
    const weekLog = await this.weekLogModel
      .findOne({
        userId: userId,
        active: true,
        // 'days.extraSessionId': new Types.ObjectId(extraSessionId),
      })
      .exec();

    if (!weekLog) {
      throw new NotFoundException(
        `No se encontró un WeekLlog con el extraSessionId "${extraSessionId}"`,
      );
    }

    this.validator.validateOwnership(weekLog, userId);

    console.log('[date]', date);
    const searchDate = parseLocalDate(date);

    const day = weekLog.days.find((d) => compareSameDay(d.date, searchDate));
    console.log('[searchDate]', searchDate);
    console.log('[day]', day);

    if (!day) {
      throw new NotFoundException(
        `No se encontró un día con el extraSessionId "${extraSessionId}, ${date}"`,
      );
    }

    day.extraSessionIds = day.extraSessionIds.filter(
      (id) => id.toString() !== extraSessionId,
    );
    // day.status = 'pending';

    await weekLog.save();

    return this.findOneDay(weekLog._id.toString(), day.order, userId);
  }
}
