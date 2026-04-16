import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { parseISO } from 'date-fns';

import { WeekLog } from '../../infrastructure/schemas/week-log.schema';
import { WeekLogValidator } from '../validators/week-log.validator';
import { WorkoutSessionService } from '../../../workout-session/workout-session.service';
import { ExtraSessionService } from '../../../extra-session/extra-session.service';
import { UpdateDayInput } from '../../presentation/dto/update-week-log.input';
import type { IWeekLogRepository } from '../../domain/interfaces/repositories/week-log.repository.interface';
import { WEEK_LOG_REPOSITORY } from '../../domain/interfaces/repositories/week-log.repository.interface';
import {
  isValidLocalDate,
  localDateToUtc,
  utcToLocalDate,
  nowUtc,
} from 'src/common/utils/date.utils';

const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

export interface UpdateWeekLogInput {
  id: string;
  notes?: string;
  completed?: boolean;
  active?: boolean;
  /** LocalDate "yyyy-MM-dd" */
  startDate?: string;
  /** LocalDate "yyyy-MM-dd" */
  endDate?: string;
  timezone?: string;
  days?: UpdateDayInput[];
}

@Injectable()
export class UpdateWeekLogUseCase {
  constructor(
    @InjectModel(WeekLog.name)
    private readonly weekLogModel: Model<WeekLog>,
    private readonly validator: WeekLogValidator,
    @Inject(forwardRef(() => WorkoutSessionService))
    private readonly workoutSessionService: WorkoutSessionService,
    private readonly extraSessionService: ExtraSessionService,
    @Inject(WEEK_LOG_REPOSITORY)
    private readonly weekLogRepository: IWeekLogRepository,
  ) {}

  async execute(input: UpdateWeekLogInput, userId: string) {
    const timezone = input.timezone ?? DEFAULT_TIMEZONE;

    // 1. Cargar el WeekLog
    const weekLog = await this.weekLogModel.findById(input.id);
    if (!weekLog) throw new NotFoundException(`WeekLog ${input.id} not found`);

    // 2. Validar ownership
    this.validator.validateOwnership(weekLog, userId);

    // 3. Actualizar campos de metadata
    if (input.notes !== undefined) weekLog.notes = input.notes;

    // startDate/endDate son LocalDate "yyyy-MM-dd" → convertir a UTC para Mongo
    if (input.startDate !== undefined) {
      if (!isValidLocalDate(input.startDate)) {
        throw new BadRequestException(
          `startDate "${input.startDate}" must be in yyyy-MM-dd format`,
        );
      }
      weekLog.startDate = localDateToUtc(input.startDate, timezone);
    }
    if (input.endDate !== undefined) {
      if (!isValidLocalDate(input.endDate)) {
        throw new BadRequestException(
          `endDate "${input.endDate}" must be in yyyy-MM-dd format`,
        );
      }
      weekLog.endDate = localDateToUtc(input.endDate, timezone);
    }

    // 4. Regla: completed = true → active = false forzado
    if (input.completed === true) {
      weekLog.completed = true;
      weekLog.active = false;
    } else {
      if (input.completed !== undefined) weekLog.completed = input.completed;
      if (input.active !== undefined) {
        weekLog.active = input.active;
        if (input.active === true) {
          await this.deactivateOtherWeekLogs(input.id, userId);
        }
      }
    }

    // 5. Procesar days (si se envían)
    if (input.days?.length) {
      for (const dayInput of input.days) {
        await this.processDay(weekLog, dayInput, userId, timezone);
      }
    }

    // 6. Persistir
    await weekLog.save();

    // 7. Retornar el WeekLog populado
    return this.weekLogRepository.findOne(input.id, userId);
  }

  // ─── Solo un WL activo por usuario ─────────────────────────────────────────

  private async deactivateOtherWeekLogs(
    currentId: string,
    userId: string,
  ): Promise<void> {
    await this.weekLogModel.updateMany(
      {
        userId: new Types.ObjectId(userId),
        _id: { $ne: new Types.ObjectId(currentId) },
        active: true,
      },
      { $set: { active: false } },
    );
  }

  // ─── Procesar un día ────────────────────────────────────────────────────────

  private async processDay(
    weekLog: WeekLog,
    dayInput: UpdateDayInput,
    userId: string,
    timezone: string,
  ): Promise<void> {
    const day = (weekLog.days as any[]).find((d) => d.order === dayInput.order);
    if (!day) {
      throw new NotFoundException(
        `Day with order ${dayInput.order} not found in WeekLog`,
      );
    }

    // WorkoutSession
    if (dayInput.workoutSession) {
      await this.handleWorkoutSession(weekLog, day, dayInput, userId, timezone);
    }

    // ExtraSession
    if (dayInput.extraSession) {
      await this.handleExtraSession(weekLog, day, dayInput, userId, timezone);
    }

    // Status override
    if (dayInput.status !== undefined) {
      day.status = dayInput.status;
    }

    // Rest override
    if (dayInput.isRest !== undefined) {
      day.isRest = dayInput.isRest;
    }

    // Safety check: isRest can only be true if no workoutSessionId exists
    if (day.workoutSessionId) {
      day.isRest = false;
    }
  }

  // ─── WorkoutSession handler ─────────────────────────────────────────────────

  private async handleWorkoutSession(
    weekLog: WeekLog,
    day: any,
    dayInput: UpdateDayInput,
    userId: string,
    timezone: string,
  ): Promise<void> {
    const wsInput = dayInput.workoutSession!;

    if (day.workoutSessionId) {
      if (wsInput.id && wsInput.id !== day.workoutSessionId.toString()) {
        throw new BadRequestException(
          `Day ${day.order} already has a WorkoutSession assigned. Use removeWorkoutSessionFromDay first before assigning a new one.`,
        );
      }
      await this.workoutSessionService.update(
        day.workoutSessionId.toString(),
        wsInput,
        userId,
      );
    } else {
      // day.date es Date UTC en Mongo → convertir a LocalDate para crear WorkoutSession
      const dayLocalDate = utcToLocalDate(day.date, timezone);
      const newSession = await this.workoutSessionService.create(
        {
          ...wsInput,
          weekLogId: (weekLog as any)._id.toString(),
          date: dayLocalDate, // ✅ LocalDate "yyyy-MM-dd"
          timezone,
          status: wsInput.status ?? 'not_started',
          exercises: wsInput.exercises ?? [],
        } as any,
        userId,
      );
      day.workoutSessionId = new Types.ObjectId((newSession as any)._id);
    }
  }

  // ─── ExtraSession handler ───────────────────────────────────────────────────

  private async handleExtraSession(
    weekLog: WeekLog,
    day: any,
    dayInput: UpdateDayInput,
    userId: string,
    timezone: string,
  ): Promise<void> {
    const esInput = dayInput.extraSession!;
    let resolvedWsId: Types.ObjectId;

    if (day.workoutSessionId) {
      resolvedWsId = day.workoutSessionId;
    } else if (dayInput.workoutSessionId) {
      const existing = await this.workoutSessionService.findOne(
        dayInput.workoutSessionId,
        userId,
      );
      if (!existing) {
        throw new BadRequestException(
          `WorkoutSession ${dayInput.workoutSessionId} not found or does not belong to user`,
        );
      }
      resolvedWsId = new Types.ObjectId(dayInput.workoutSessionId);
      day.workoutSessionId = resolvedWsId;
    } else {
      // day.date es Date UTC → LocalDate para la sesión vacía
      const dayLocalDate = utcToLocalDate(day.date, timezone);
      const emptySession = await this.workoutSessionService.create(
        {
          weekLogId: (weekLog as any)._id.toString(),
          date: dayLocalDate, // ✅ LocalDate
          timezone,
          status: 'not_started',
          exercises: [],
        } as any,
        userId,
      );
      resolvedWsId = new Types.ObjectId((emptySession as any)._id);
      day.workoutSessionId = resolvedWsId;
    }

    const extraSession = await this.extraSessionService.create(
      {
        ...esInput,
        workoutSessionId: resolvedWsId.toString(),
        timezone,
      },
      userId,
    );

    if (!day.extraSessionIds) day.extraSessionIds = [];
    day.extraSessionIds.push(new Types.ObjectId((extraSession as any)._id));
  }
}
