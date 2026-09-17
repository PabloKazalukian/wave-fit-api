import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import type { IDayLogRepository } from '../../domain/interfaces/repositories/day-log.repository.interface';
import { DAY_LOG_REPOSITORY } from '../../domain/interfaces/repositories/day-log.repository.interface';
import { DayLogDomain } from '../../domain/entities/day-log.domain';
import { UpdateDayLogInput } from '../../presentation/dto/update-day-log.input';
import { DayLogExtraSessionInput } from '../../presentation/dto/day-log-extra-session.input';
import { DayLogValidator } from '../validators/day-log.validator';
import { ExtraSessionService } from '../../../extra-session/extra-session.service';
import { WorkoutSessionService } from '../../../workout-session/workout-session.service';
import { UpdateWorkoutSessionInput } from '../../../workout-session/dto/update-workout-session.input';
import { StatusWorkoutSessionEnum } from '../../../workout-session/schema/workout-session.schema';
import { utcToLocalDate } from 'src/common/utils/date.utils';

const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

@Injectable()
export class UpdateDayLogUseCase {
  constructor(
    @Inject(DAY_LOG_REPOSITORY)
    private readonly dayLogRepository: IDayLogRepository,
    private readonly validator: DayLogValidator,
    private readonly extraSessionService: ExtraSessionService,
    @Inject(forwardRef(() => WorkoutSessionService))
    private readonly workoutSessionService: WorkoutSessionService,
  ) {}

  async execute(
    input: UpdateDayLogInput,
    userId: string,
  ): Promise<DayLogDomain | null> {
    const {
      id,
      active,
      completed,
      notes,
      extraSession,
      workoutSession,
      status,
    } = input;

    const dayLog = await this.dayLogRepository.findOne(id, userId);
    if (!dayLog) {
      throw new NotFoundException(`DayLog con ID "${id}" no encontrado`);
    }
    this.validator.validateOwnership(dayLog, userId);

    const update: any = {};

    // --- WorkoutSession principal (parity con updateWeekDay) ---
    if (workoutSession) {
      await this.handleWorkoutSession(
        dayLog,
        workoutSession,
        input,
        userId,
        update,
      );
    }

    // --- ExtraSession ---
    if (extraSession) {
      await this.handleExtraSession(
        dayLog,
        extraSession,
        input,
        userId,
        update,
      );
    }

    if (notes !== undefined) update.notes = notes;

    if (completed === true) {
      // Regla: completed = true finaliza el day-log (active = false) y garantiza
      // un WorkoutSession. `status` es dato de display del front: no se infiere.
      await this.ensureWorkoutSession(dayLog, input, userId, update);
      update.completed = true;
      update.active = false;
    } else {
      if (completed !== undefined) update.completed = completed;
      if (active !== undefined) update.active = active;
    }

    // `status` es 100% del front: se persiste tal cual, sin efectos colaterales
    // (no toca completed, active ni el WorkoutSession).
    if (status !== undefined) update.status = status;

    if (Object.keys(update).length === 0) {
      return dayLog;
    }

    return this.dayLogRepository.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });
  }

  // ─── WorkoutSession handler (mismo esquema que updateWeekDay) ─────────────

  private async handleWorkoutSession(
    dayLog: DayLogDomain,
    wsInput: UpdateWorkoutSessionInput,
    input: UpdateDayLogInput,
    userId: string,
    update: any,
  ): Promise<void> {
    const timezone = input.timezone ?? DEFAULT_TIMEZONE;

    if (dayLog.workoutSessionId) {
      if (wsInput.id && wsInput.id !== dayLog.workoutSessionId.toString()) {
        throw new BadRequestException(
          `DayLog ya tiene un WorkoutSession asignado. Removelo antes de asignar uno nuevo.`,
        );
      }
      await this.workoutSessionService.update(
        dayLog.workoutSessionId.toString(),
        wsInput,
        userId,
      );
    } else {
      // dayLog.date es Date UTC en Mongo → convertir a LocalDate "yyyy-MM-dd"
      const dayLocalDate = utcToLocalDate(dayLog.date, timezone);
      const newSession = await this.workoutSessionService.create(
        {
          ...wsInput,
          dayLogId: dayLog.id,
          date: dayLocalDate,
          timezone,
          status: wsInput.status ?? StatusWorkoutSessionEnum.NOT_STARTED,
          exercises: wsInput.exercises ?? [],
        } as any,
        userId,
      );
      update.workoutSessionId = new Types.ObjectId((newSession as any)._id);
    }
  }

  // ─── Garantiza un WorkoutSession al completar el día ──────────────────────

  private async ensureWorkoutSession(
    dayLog: DayLogDomain,
    input: UpdateDayLogInput,
    userId: string,
    update: any,
  ): Promise<void> {
    if (dayLog.workoutSessionId || update.workoutSessionId) return;

    const timezone = input.timezone ?? DEFAULT_TIMEZONE;
    const dayLocalDate = utcToLocalDate(dayLog.date, timezone);
    const emptySession = await this.workoutSessionService.create(
      {
        date: dayLocalDate,
        timezone,
        dayLogId: dayLog.id,
        status: StatusWorkoutSessionEnum.NOT_STARTED,
        exercises: [],
      } as any,
      userId,
    );
    update.workoutSessionId = new Types.ObjectId((emptySession as any)._id);
  }

  // ─── ExtraSession handler (mismo esquema que updateWeekDay) ──────────────────

  private async handleExtraSession(
    dayLog: DayLogDomain,
    esInput: DayLogExtraSessionInput,
    input: UpdateDayLogInput,
    userId: string,
    update: any,
  ): Promise<void> {
    const timezone = input.timezone ?? DEFAULT_TIMEZONE;

    // Resolver el WS ID con orden de prioridad:
    // 1. dayLog.workoutSessionId (ya persistido en el DayLog)
    // 2. input.workoutSessionId enviado por el cliente (verificar existencia)
    // 3. Crear WS vacío
    let resolvedWsId: Types.ObjectId;

    if (dayLog.workoutSessionId) {
      resolvedWsId = new Types.ObjectId(dayLog.workoutSessionId);
    } else if (input.workoutSessionId) {
      const existing = await this.workoutSessionService.findOne(
        input.workoutSessionId,
        userId,
      );
      if (!existing) {
        throw new BadRequestException(
          `WorkoutSession ${input.workoutSessionId} not found or does not belong to user`,
        );
      }
      resolvedWsId = new Types.ObjectId(input.workoutSessionId);
      update.workoutSessionId = resolvedWsId;
    } else {
      // dayLog.date es Date UTC en Mongo → convertir a LocalDate "yyyy-MM-dd"
      const dayLocalDate = utcToLocalDate(dayLog.date, timezone);
      const emptySession = await this.workoutSessionService.create(
        {
          date: dayLocalDate,
          timezone,
          dayLogId: dayLog.id,
          status: 'not_started',
          exercises: [],
        } as any,
        userId,
      );
      resolvedWsId = new Types.ObjectId((emptySession as any)._id);
      update.workoutSessionId = resolvedWsId;
    }

    // Crear la ExtraSession vinculada al WS resuelto
    const extraSession = await this.extraSessionService.create(
      {
        ...esInput,
        workoutSessionId: resolvedWsId.toString(),
        timezone,
      },
      userId,
    );

    const currentIds = (dayLog.extraSessionIds ?? []).map((x: any) =>
      x.toString(),
    );
    update.extraSessionIds = [
      ...currentIds,
      (extraSession as any)._id.toString(),
    ].map((strId) => new Types.ObjectId(strId));
  }
}
