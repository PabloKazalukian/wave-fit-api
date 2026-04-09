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

export interface UpdateWeekLogInput {
  id: string;
  notes?: string;
  completed?: boolean;
  active?: boolean;
  startDate?: string;
  endDate?: string;
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
    // 1. Cargar el WeekLog
    const weekLog = await this.weekLogModel.findById(input.id);
    if (!weekLog) throw new NotFoundException(`WeekLog ${input.id} not found`);

    // 2. Validar ownership
    this.validator.validateOwnership(weekLog, userId);

    // 3. Actualizar campos de metadata
    if (input.notes !== undefined) weekLog.notes = input.notes;
    if (input.startDate !== undefined)
      weekLog.startDate = parseISO(input.startDate);
    if (input.endDate !== undefined) weekLog.endDate = parseISO(input.endDate);

    // 4. Regla: completed = true → active = false forzado
    if (input.completed === true) {
      weekLog.completed = true;
      weekLog.active = false;
    } else {
      if (input.completed !== undefined) weekLog.completed = input.completed;
      if (input.active !== undefined) {
        weekLog.active = input.active;
        // Si se activa este WL, desactivar todos los demás del mismo usuario
        if (input.active === true) {
          await this.deactivateOtherWeekLogs(input.id, userId);
        }
      }
    }

    // 5. Procesar days (si se envían)
    if (input.days?.length) {
      for (const dayInput of input.days) {
        await this.processDay(weekLog, dayInput, userId);
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
  ): Promise<void> {
    const day = (weekLog.days as any[]).find((d) => d.order === dayInput.order);
    if (!day) {
      throw new NotFoundException(
        `Day with order ${dayInput.order} not found in WeekLog`,
      );
    }

    // WorkoutSession
    if (dayInput.workoutSession) {
      await this.handleWorkoutSession(weekLog, day, dayInput, userId);
    }

    // ExtraSession
    if (dayInput.extraSession) {
      await this.handleExtraSession(weekLog, day, dayInput, userId);
    }

    // Status override
    if (dayInput.status !== undefined) {
      day.status = dayInput.status;
    }
  }

  // ─── WorkoutSession handler ─────────────────────────────────────────────────

  private async handleWorkoutSession(
    weekLog: WeekLog,
    day: any,
    dayInput: UpdateDayInput,
    userId: string,
  ): Promise<void> {
    const wsInput = dayInput.workoutSession!;

    if (day.workoutSessionId) {
      // El day ya tiene un WS → verificar que el ID coincida y actualizar
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
      // No tiene WS → crear nuevo
      const newSession = await this.workoutSessionService.create(
        {
          ...wsInput,
          weekLogId: (weekLog as any)._id.toString(),
          date: day.date.toISOString(),
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
  ): Promise<void> {
    const esInput = dayInput.extraSession!;
    let resolvedWsId: Types.ObjectId;

    if (day.workoutSessionId) {
      // Prioridad 1: usar el WS que ya tiene el día
      resolvedWsId = day.workoutSessionId;
    } else if (dayInput.workoutSessionId) {
      // Prioridad 2: cliente envió un WS ID explícito → verificar existencia
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
      // Prioridad 3: crear WS vacío y marcar el día como descanso
      const emptySession = await this.workoutSessionService.create(
        {
          weekLogId: (weekLog as any)._id.toString(),
          date: day.date.toISOString(),
          status: 'not_started',
          exercises: [],
        } as any,
        userId,
      );
      resolvedWsId = new Types.ObjectId((emptySession as any)._id);
      day.workoutSessionId = resolvedWsId;
      day.isRest = true;
    }

    // Crear la ExtraSession vinculada al WS resuelto
    const extraSession = await this.extraSessionService.create(
      {
        ...esInput,
        workoutSessionId: resolvedWsId.toString(),
      },
      userId,
    );

    if (!day.extraSessionIds) day.extraSessionIds = [];
    day.extraSessionIds.push(new Types.ObjectId((extraSession as any)._id));
  }
}
