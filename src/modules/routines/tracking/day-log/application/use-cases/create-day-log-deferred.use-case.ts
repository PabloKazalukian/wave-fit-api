import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { isValidLocalDate, localDateToUtc, todayInTimezone } from 'src/common/utils/date.utils';
import type { IDayLogRepository } from '../../domain/interfaces/repositories/day-log.repository.interface';
import { DAY_LOG_REPOSITORY } from '../../domain/interfaces/repositories/day-log.repository.interface';
import { DayLogDomain } from '../../domain/entities/day-log.domain';
import { CreateDayLogDeferredInput } from '../../presentation/dto/create-day-log-deferred.input';
import { WorkoutSessionService } from '../../../workout-session/workout-session.service';
import { StatusWorkoutSessionEnum } from '../../../workout-session/schema/workout-session.schema';
import { RoutineDayService } from 'src/modules/routines/templates/routine-day/routine-day.service';
import type { IWeekLogRepository } from '../../../week-log/domain/interfaces/repositories/week-log.repository.interface';
import { WEEK_LOG_REPOSITORY } from '../../../week-log/domain/interfaces/repositories/week-log.repository.interface';

const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

@Injectable()
export class CreateDayLogDeferredUseCase {
  constructor(
    @Inject(DAY_LOG_REPOSITORY)
    private readonly dayLogRepository: IDayLogRepository,
    @Inject(WEEK_LOG_REPOSITORY)
    private readonly weekLogRepository: IWeekLogRepository,
    @Inject(forwardRef(() => WorkoutSessionService))
    private readonly workoutSessionService: WorkoutSessionService,
    private readonly routineDayService: RoutineDayService,
  ) {}

  async execute(
    input: CreateDayLogDeferredInput,
    userId: string,
  ): Promise<DayLogDomain | null> {
    const { date: localDate, timezone: tz, planId, routineDayId, notes } = input;

    if (!isValidLocalDate(localDate)) {
      throw new BadRequestException(
        `date "${localDate}" must be in yyyy-MM-dd format`,
      );
    }

    const resolvedTimezone = tz ?? DEFAULT_TIMEZONE;
    const todayLocal = todayInTimezone(resolvedTimezone);

    // Solo se permite fechas pasadas (estrictamente antes de hoy)
    if (localDate >= todayLocal) {
      throw new BadRequestException(
        'Solo se permite crear day-log diferido para fechas pasadas',
      );
    }

    // Validar que no exista un day-log para ese usuario y esa fecha (cualquier estado, no eliminado)
    const dateStartUtc = localDateToUtc(localDate, resolvedTimezone);
    const dateEndUtc = new Date(dateStartUtc.getTime() + 24 * 60 * 60 * 1000);
    const existingDayLog = await this.dayLogRepository.findOneByUserAndDate(
      userId,
      dateStartUtc,
      dateEndUtc,
    );
    if (existingDayLog) {
      throw new BadRequestException('Ya existe un day-log para esta fecha');
    }

    // Validar que la fecha no esté dentro de ningún week-log del usuario (activo o no)
    const existingWeekLog = await this.weekLogRepository.findOneByUserAndDate(
      userId,
      dateStartUtc,
    );
    if (existingWeekLog) {
      throw new BadRequestException(
        'La fecha pertenece a un week-log. Edita el week-log directamente para completar ese día.',
      );
    }

    // Construir el día‑log con active: false y completed: false (para editar después)
    const dayLogId = new Types.ObjectId().toString();
    const dayLog = DayLogDomain.create(
      dayLogId,
      userId,
      dateStartUtc,
      planId || null,
      routineDayId || null,
    );
    // Asegurar los valores por defecto (el constructor ya los establece, pero lo dejamos explícito)
    dayLog.active = false;
    dayLog.completed = false;
    dayLog.status = 'pending';
    if (notes !== undefined) dayLog.notes = notes;

    // Si viene routineDayId, crear sesión con ejercicios mapeados, pero completed sigue false
    if (routineDayId) {
      const routineDay = await this.routineDayService.findOne(routineDayId);
      if (!routineDay) {
        throw new NotFoundException(
          `RoutineDay con ID "${routineDayId}" no encontrado`,
        );
      }
      const exercises = routineDay.exercises?.map((e: any) => ({
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

      const session = await this.workoutSessionService.create(
        {
          date: localDate,
          timezone: resolvedTimezone,
          routineDayId,
          dayLogId,
          exercises,
          status: StatusWorkoutSessionEnum.NOT_STARTED,
          notes: '',
          edited: false,
          deleted: false,
        } as any,
        userId,
      );
      // No marcamos completed=true aquí; el día queda pendiente de edición.
      await this.dayLogRepository.updateStatus(
        dayLogId,
        dayLog.status,
        (session as any)._id.toString(),
        false, // completed false
      );
    } else {
      // Sin routineDayId: no crear sesión ahora; el día quedará "vacío" para que el usuario la agregue después.
      // Aún así, podríamos crear una sesión vacía opcional; por ahora dejamos workoutSessionId en null.
      await this.dayLogRepository.updateStatus(
        dayLogId,
        dayLog.status,
        null,
        false,
      );
    }

    // Persistir el día‑log y retornar poblado
    const newDayLog = await this.dayLogRepository.create(dayLog);
    const result = await this.dayLogRepository.findOne(newDayLog.id, userId);
    return result;
  }
}