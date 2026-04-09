import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { CreateWeekLogInput } from './presentation/dto/create-week-log.input';
import {
  UpdateWeekLogDayInput,
  UpdateWeekLogWorkoutSessionInput,
  UpdateWeekLogExtraSessionInput,
} from './presentation/dto/update-week-log.input';
import { WeekLog } from './infrastructure/schemas/week-log.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, UpdateQuery } from 'mongoose';
import { addDays, parseISO, isSameDay } from 'date-fns';
import { WorkoutSession } from '../workout-session/schema/workout-session.schema';
import { RoutineDayService } from '../../templates/routine-day/routine-day.service';
import { WeekLogValidator } from './application/validators/week-log.validator';
import {
  CreateWeekLogUseCase,
  FindAllWeekLogsByUserUseCase,
  UpdateDayUseCase,
} from './application/use-cases';
import { WeekLogDomain } from './domain/entities/week-log.domain';
import { WorkoutSessionService } from '../workout-session/workout-session.service';
import { ExtraSessionService } from '../extra-session/extra-session.service';

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
    @Inject(forwardRef(() => WorkoutSessionService))
    private readonly workoutSessionService: WorkoutSessionService,
    private readonly extraSessionService: ExtraSessionService,
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
      .exec();

    if (!weekLog) return null;

    return this.mapWeekLog(weekLog);
  }

  private mapWeekLog(weekLog: any): any {
    const weekLogObj = weekLog.toObject ? weekLog.toObject() : weekLog;

    const mapped = {
      ...weekLogObj,
      id: weekLogObj._id.toString(),
      days: weekLogObj.days.map((day) => {
        const session = day.workoutSessionId;
        return {
          ...day,
          workoutSessionId: session?._id ? session._id.toString() : session,
          exercises: session?.exercises || [],
        };
      }),
    };

    return mapped;
  }

  async updateWithWorkoutSession(
    id: string,
    updateWeekLogInput: UpdateWeekLogWorkoutSessionInput,
    userId: string,
  ) {
    const weekLog = await this.weekLogModel.findById(id);
    if (!weekLog) throw new NotFoundException(`WeekLog ${id} not found`);

    this.validator.validateOwnership(weekLog, userId);
    this.validator.validateUpdate(updateWeekLogInput);

    await this.applyUpdateInput(weekLog, updateWeekLogInput, userId);

    await weekLog.save();
    return this.findOne(id, userId);
  }

  async updateWithExtraSession(
    id: string,
    updateWeekLogInput: UpdateWeekLogExtraSessionInput,
    userId: string,
  ) {
    const weekLog = await this.weekLogModel.findById(id);
    console.log('[updateWithExtraSession] weekLog', weekLog);
    if (!weekLog) throw new NotFoundException(`WeekLog ${id} not found`);

    this.validator.validateOwnership(weekLog, userId);

    if (updateWeekLogInput.days?.length) {
      console.log(
        '[updateWithExtraSession] updateWeekLogInput.days',
        updateWeekLogInput.days,
      );
      for (const dayInput of updateWeekLogInput.days) {
        const day = weekLog.days.find((d) => d.order === dayInput.order);
        if (!day) continue;

        let targetWsId = day.workoutSessionId;
        if (!targetWsId) {
          const newSession = await this.workoutSessionService.create(
            {
              weekLogId: (weekLog as any)._id.toString(),
              date: day.date.toISOString(),
              status: 'not_started',
              exercises: [],
            } as any,
            userId,
          );
          targetWsId = new Types.ObjectId((newSession as any)._id);
          day.workoutSessionId = targetWsId;
          day.isRest = true;
        }

        if (dayInput.extraSession) {
          const extraSession = await this.extraSessionService.create(
            {
              ...dayInput.extraSession,
              workoutSessionId: targetWsId.toString(),
            },
            userId,
          );

          if (!day.extraSessionIds) day.extraSessionIds = [];
          day.extraSessionIds.push(
            new Types.ObjectId((extraSession as any)._id),
          );
        }
      }
    }

    await weekLog.save();
    return this.findOne(id, userId);
  }

  /**
   * Mutation unificada: crea/actualiza WS y ES en un day del WL.
   * Delega toda la lógica al UpdateDayUseCase.
   */
  async updateDay(
    input: import('./presentation/dto/update-week-log.input').UpdateWeekLogDayUnifiedInput,
    userId: string,
  ) {
    return this.updateDayUseCase.execute(input, userId);
  }

  async updateDay_legacy(input: UpdateWeekLogDayInput, userId: string) {
    const weekLog = await this.weekLogModel.findById(input.workoutSessionId);

    if (!weekLog) throw new NotFoundException('WeekLog not found');

    this.validator.validateOwnership(weekLog, userId);

    const day = weekLog.days.find((d) => d.order === input.order);

    if (!day) throw new NotFoundException('Day not found');

    if (input.status) day.status = input.status;

    await weekLog.save();
    return this.findOne(weekLog._id.toString(), userId);
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
      const session = sessions.find((s) => isSameDay(s.date, day.date));

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

  // private createInitialDaysAndSessions(
  //   userId: string,
  //   weekLogId: string,
  //   startDate: Date,
  //   plan?: any,
  // ) {
  //   const sessionsToInsert: any[] = [];
  //   let isRestMap: boolean[] = new Array(7).fill(false);

  //   if (plan?.week?.length === 7) {
  //     isRestMap = plan.week.map((d) => d.isRest);
  //   }

  //   const days = Array.from({ length: 7 }).map((_, index) => {
  //     let workoutSessionId: Types.ObjectId | null = null;

  //     if (plan && plan.week && plan.week.length === 7 && !isRestMap[index]) {
  //       const planDay = plan.week[index];
  //       if (planDay && planDay.day) {
  //         const routineDay = planDay.day;
  //         const exercises =
  //           routineDay.exercises?.map((e: any) => ({
  //             exerciseId: (
  //               e.exercise._id ||
  //               e.exercise.id ||
  //               e.exercise
  //             ).toString(),
  //             series: 0,
  //             sets: [],
  //           })) || [];

  //         const sessionObjectId = new Types.ObjectId();
  //         workoutSessionId = sessionObjectId;
  //         sessionsToInsert.push({
  //           _id: sessionObjectId,
  //           userId,
  //           weekLogId,
  //           date: addDays(startDate, index),
  //           routineDayId: routineDay._id.toString(),
  //           exercises,
  //           status: 'not_started',
  //         });
  //       }
  //     }

  //     return {
  //       order: index + 1,
  //       date: addDays(startDate, index),
  //       isRest: isRestMap[index] ?? false,
  //       workoutSessionId,
  //       extraSessionIds: [],
  //       status: 'pending',
  //     };
  //   });

  //   return { days, sessionsToInsert };
  // }

  private async applyUpdateInput(
    weekLog: WeekLog,
    updateInput: UpdateWeekLogWorkoutSessionInput,
    userId: string,
  ): Promise<void> {
    if (updateInput.startDate)
      weekLog.startDate = parseISO(updateInput.startDate);
    if (updateInput.endDate) weekLog.endDate = parseISO(updateInput.endDate);
    if (updateInput.planId !== undefined)
      weekLog.planId = updateInput.planId
        ? new Types.ObjectId(updateInput.planId)
        : undefined;
    if (updateInput.notes !== undefined) weekLog.notes = updateInput.notes;
    if (updateInput.active !== undefined) weekLog.active = updateInput.active;
    if (updateInput.completed !== undefined)
      weekLog.completed = updateInput.completed;

    if (updateInput.days?.length) {
      for (const dayInput of updateInput.days) {
        const day = weekLog.days.find((d) => d.order === dayInput.order);
        if (!day) continue;

        // Nested WorkoutSession handling
        if (dayInput.workoutSession) {
          const wsInput = dayInput.workoutSession;
          if (!day.workoutSessionId) {
            // Case 1: No session in DB, create new one
            if (wsInput.id) {
              // If input has an ID but DB doesn't, we can either assign it or throw.
              // Logic says: "detectar si el usuario creo un nuevo WS (sin id)".
              // If it has an ID, maybe it's an assignment?
              // But user said: "detectar si el usuario creo un nuevo WS(sin id obviamente) y asignara a ese WL-day un nuevo WS"
              // "Validadara ahora que este WS este bien... y revisara si ese dia ya tiene o no un id de WS, si tiene devuleve ERRROR, sino hace la operacion."

              // If wsInput.id exists, it might be an assignment by ID.
              day.workoutSessionId = new Types.ObjectId(wsInput.id);
            } else {
              // New session creation
              const newSession = await this.workoutSessionService.create(
                {
                  ...wsInput,
                  weekLogId: (weekLog as any)._id.toString(),
                  date: day.date.toISOString(),
                } as any,
                userId,
              );
              day.workoutSessionId = new Types.ObjectId(
                (newSession as any)._id,
              );
            }
          } else {
            // Case 2: Day already has a session
            if (wsInput.id && wsInput.id === day.workoutSessionId.toString()) {
              // Update existing session
              await this.workoutSessionService.update(
                wsInput.id,
                wsInput,
                userId,
              );
            } else {
              // IDs dont match or trying to create new on occupied day
              throw new BadRequestException(
                `Day ${day.order} already has a WorkoutSession assigned. Use removeWorkoutSessionFromDay first before assigning a new one.`,
              );
            }
          }
        }

        // Only update workoutSessionId directly if nested workoutSession was NOT provided
        if (
          dayInput.workoutSessionId !== undefined &&
          !dayInput.workoutSession
        ) {
          day.workoutSessionId = dayInput.workoutSessionId
            ? new Types.ObjectId(dayInput.workoutSessionId)
            : null;
        }
        if (dayInput.extraSessionIds !== undefined) {
          day.extraSessionIds = dayInput.extraSessionIds.map(
            (id) => new Types.ObjectId(id),
          );
        }
        if (dayInput.status !== undefined) {
          day.status = dayInput.status;
        }
      }
    }
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

    return this.findOne(weekLog._id.toString(), userId);
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
      const searchDate = new Date(date);

      // 4. Encontrar el día en el weekLog
      const dayToUpdate = weekLog.days.find((d) => {
        const dayDate = new Date(d.date);
        dayDate.setUTCHours(0, 0, 0, 0);
        return dayDate.getTime() === searchDate.getTime();
      });

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

      // 8. Retornar el weekLog actualizado
      const result = await this.findOne(weekLog._id.toString(), userId);
      return result;
    } catch (error) {
      console.error('[assignRoutineToDay] Error:', error);
      throw error;
    }
  }
}
