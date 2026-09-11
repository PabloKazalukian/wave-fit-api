import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { isValidLocalDate } from 'src/common/utils/date.utils';
import type { IDayLogRepository } from '../../domain/interfaces/repositories/day-log.repository.interface';
import { DAY_LOG_REPOSITORY } from '../../domain/interfaces/repositories/day-log.repository.interface';
import { DayLogDomain } from '../../domain/entities/day-log.domain';
import { CreateDayLogInput } from '../../presentation/dto/create-day-log.input';
import { DayLogValidator } from '../validators/day-log.validator';
import { WorkoutSessionService } from '../../../workout-session/workout-session.service';
import { localDateToUtc } from 'src/common/utils/date.utils';
import { StatusWorkoutSessionEnum } from '../../../workout-session/schema/workout-session.schema';
import { RoutineDayService } from 'src/modules/routines/templates/routine-day/routine-day.service';

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
    const { date: localDate, timezone, planId, routineDayId, notes } = input;

    if (!isValidLocalDate(localDate)) {
      throw new Error(`date "${localDate}" must be in yyyy-MM-dd format`);
    }

    // 1. Validar que no exista un day-log activo para el usuario
    const activeDayLog = await this.dayLogRepository.findActive(userId);
    await this.validator.validateCreation(localDate, activeDayLog !== null);

    // Fase C: no se puede crear day-log si hay una semana activa
    await this.validator.validateNoActiveWeek(userId);

    // 2. Construir el dominio (día suelto activo)
    const dayLogId = new Types.ObjectId().toString();
    const dateUtc = localDateToUtc(localDate, timezone);
    const dayLog = DayLogDomain.create(
      dayLogId,
      userId,
      dateUtc,
      planId || null,
      routineDayId || null,
    );

    // 3. Si viene un routineDayId, crear la WorkoutSession inicial con sus ejercicios
    if (routineDayId) {
      try {
        const routineDay = await this.routineDayService.findOne(routineDayId);
        if (!routineDay) {
          throw new NotFoundException(
            `RoutineDay con ID "${routineDayId}" no encontrado`,
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

        const session = await this.workoutSessionService.create(
          {
            date: localDate,
            timezone,
            routineDayId,
            exercises,
            status: StatusWorkoutSessionEnum.NOT_STARTED,
            notes: '',
            edited: false,
            deleted: false,
          } as any,
          userId,
        );
        dayLog.workoutSessionId = (session as any)._id.toString();
      } catch (err) {
        throw err;
      }
    }

    if (notes !== undefined) dayLog.notes = notes;

    // 4. Persistir
    const newDayLog = await this.dayLogRepository.create(dayLog);

    // 5. Retornar el day log creado (populated)
    const result = await this.dayLogRepository.findOne(newDayLog.id, userId);
    return result;
  }
}
