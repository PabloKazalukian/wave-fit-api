import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { isValidLocalDate, localDateToUtc } from 'src/common/utils/date.utils';
import type { IDayLogRepository } from '../../domain/interfaces/repositories/day-log.repository.interface';
import { DAY_LOG_REPOSITORY } from '../../domain/interfaces/repositories/day-log.repository.interface';
import { DayLogDomain } from '../../domain/entities/day-log.domain';
import { CreateDayLogInput } from '../../presentation/dto/create-day-log.input';
import { DayLogValidator } from '../validators/day-log.validator';
import { WorkoutSessionService } from '../../../workout-session/workout-session.service';
import { StatusWorkoutSessionEnum } from '../../../workout-session/schema/workout-session.schema';
import { RoutineDayService } from 'src/modules/routines/templates/routine-day/routine-day.service';

const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

@Injectable()
export class CreateDayLogUseCase {
  constructor(
    @Inject(DAY_LOG_REPOSITORY)
    private readonly dayLogRepository: IDayLogRepository,
    private readonly validator: DayLogValidator,
    @Inject(forwardRef(() => WorkoutSessionService))
    private readonly workoutSessionService: WorkoutSessionService,
    private readonly routineDayService: RoutineDayService,
  ) {}

  async execute(
    input: CreateDayLogInput,
    userId: string,
  ): Promise<DayLogDomain | null> {
    const { date: localDate, timezone: tz, planId, routineDayId, notes } = input;

    if (!isValidLocalDate(localDate)) {
      throw new BadRequestException(
        `date "${localDate}" must be in yyyy-MM-dd format`,
      );
    }

    // 1. Validar que no exista un day-log activo para el usuario
    const activeDayLog = await this.dayLogRepository.findActive(userId);
    await this.validator.validateCreation(localDate, activeDayLog !== null);

    // Fase C: no se puede crear day-log si hay una semana activa
    await this.validator.validateNoActiveWeek(userId);

    // 2. Construir el dominio (día suelto activo)
    const dayLogId = new Types.ObjectId().toString();
    const resolvedTimezone = tz ?? DEFAULT_TIMEZONE;
    const dateUtc = localDateToUtc(localDate, resolvedTimezone);
    const dayLog = DayLogDomain.create(
      dayLogId,
      userId,
      dateUtc,
      planId || null,
      routineDayId || null,
    );

    // 3. Si viene un routineDayId, resolver el routine day y sus ejercicios (validación temprana)
    let routineExercises: any[] | null = null;
    if (routineDayId) {
      const routineDay = await this.routineDayService.findOne(routineDayId);
      if (!routineDay) {
        throw new NotFoundException(
          `RoutineDay con ID "${routineDayId}" no encontrado`,
        );
      }

      routineExercises =
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
    }

    if (notes !== undefined) dayLog.notes = notes;

    // 4. Persistir el day-log antes de crear la WorkoutSession (la sesión referencia
    //    dayLogId y su ownership se valida contra el documento ya persistido)
    const newDayLog = await this.dayLogRepository.create(dayLog);
    const persistedDayLogId = newDayLog.id;

    // 5. Crear la WorkoutSession inicial con sus ejercicios y back-reference al day-log
    if (routineDayId && routineExercises) {
      const session = await this.workoutSessionService.create(
        {
          date: localDate,
          timezone: resolvedTimezone,
          routineDayId,
          dayLogId: persistedDayLogId,
          exercises: routineExercises,
          status: StatusWorkoutSessionEnum.NOT_STARTED,
          notes: '',
          edited: false,
          deleted: false,
        } as any,
        userId,
      );
      await this.dayLogRepository.updateStatus(
        persistedDayLogId,
        dayLog.status,
        (session as any)._id.toString(),
      );
    }

    // 6. Retornar el day log creado (populated)
    const result = await this.dayLogRepository.findOne(persistedDayLogId, userId);
    return result;
  }
}
