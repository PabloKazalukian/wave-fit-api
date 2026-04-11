import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { WeekLog } from '../../infrastructure/schemas/week-log.schema';
import { WeekLogValidator } from '../validators/week-log.validator';
import { WorkoutSessionService } from '../../../workout-session/workout-session.service';
import { ExtraSessionService } from '../../../extra-session/extra-session.service';
import {
  UpdateDayInput,
  UpdateWeekLogDayUnifiedInput,
} from '../../presentation/dto/update-week-log.input';
import type { IWeekLogRepository } from '../../domain/interfaces/repositories/week-log.repository.interface';
import { WEEK_LOG_REPOSITORY } from '../../domain/interfaces/repositories/week-log.repository.interface';

@Injectable()
export class UpdateDayUseCase {
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

  async execute(input: UpdateWeekLogDayUnifiedInput, userId: string) {
    // 1. Cargar el WeekLog
    console.log('[update-day.use-case] input', input);
    const weekLog = await this.weekLogModel.findById(input.id);
    if (!weekLog) throw new NotFoundException(`WeekLog ${input.id} not found`);

    // 2. Validar ownership
    this.validator.validateOwnership(weekLog, userId);

    // 3. Procesar cada día del input
    for (const dayInput of input.days) {
      console.log('[update-day.use-case] dayInput', dayInput);
      await this.processDay(weekLog, dayInput, userId);
    }

    // 4. Persistir
    await weekLog.save();

    // 5. Retornar el WeekLog populado
    return this.weekLogRepository.findOne(input.id, userId);
  }

  // ─────────────────────────────────────────────────────────────────────────────

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

    // --- WorkoutSession ---
    if (dayInput.workoutSession) {
      await this.handleWorkoutSession(weekLog, day, dayInput, userId);
    }

    // --- ExtraSession ---
    if (dayInput.extraSession) {
      await this.handleExtraSession(weekLog, day, dayInput, userId);
    }

    // --- Status override ---
    if (dayInput.status !== undefined) {
      day.status = dayInput.status;
    }

    // --- Rest override ---
    if (dayInput.isRest !== undefined) {
      day.isRest = dayInput.isRest;
    }

    // --- Safety check: isRest can only be true if no workoutSessionId exists ---
    if (day.workoutSessionId) {
      day.isRest = false;
    }
  }

  // ─── WorkoutSession handler ───────────────────────────────────────────────────

  private async handleWorkoutSession(
    weekLog: WeekLog,
    day: any,
    dayInput: UpdateDayInput,
    userId: string,
  ): Promise<void> {
    const wsInput = dayInput.workoutSession!;

    if (day.workoutSessionId) {
      // El day ya tiene un WS → actualizar
      await this.workoutSessionService.update(
        day.workoutSessionId.toString(),
        wsInput,
        userId,
      );
    } else {
      // El day no tiene WS → crear uno nuevo
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

  // ─── ExtraSession handler ─────────────────────────────────────────────────────

  private async handleExtraSession(
    weekLog: WeekLog,
    day: any,
    dayInput: UpdateDayInput,
    userId: string,
  ): Promise<void> {
    const esInput = dayInput.extraSession!;

    // Resolver el WS ID con orden de prioridad:
    // 1. day.workoutSessionId (ya persistido en el WL)
    // 2. dayInput.workoutSessionId enviado por el cliente (verificar existencia)
    // 3. Crear WS vacío (isRest = true)
    let resolvedWsId: Types.ObjectId;

    if (day.workoutSessionId) {
      // Prioridad 1: usar el WS que ya tiene el día
      resolvedWsId = day.workoutSessionId;
    } else if (dayInput.workoutSessionId) {
      // Prioridad 2: el cliente mandó un WS ID explícito
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
      // Prioridad 3: crear WS vacío, marcar el día como descanso
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
