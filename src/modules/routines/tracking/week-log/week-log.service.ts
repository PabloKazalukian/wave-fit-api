import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateWeekLogInput } from './dto/create-week-log.input';
import {
  UpdateWeekLogDayInput,
  UpdateWeekLogInput,
} from './dto/update-week-log.input';
import { WeekLog } from './schema/week-log.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, UpdateQuery } from 'mongoose';
import { addDays, parseISO, isSameDay } from 'date-fns';
import { WeekLogValidator } from './week-log.validator';
import { WorkoutSession } from '../workout-session/schema/workout-session.schema';
import { RoutinePlan as RoutinePlanSchema } from '../../templates/routine-plan/schema/routine-plan.schema';
import { RoutineDayService } from '../../templates/routine-day/routine-day.service';

@Injectable()
export class WeekLogService {
  constructor(
    @InjectModel(WeekLog.name) private weekLogModel: Model<WeekLog>,
    @InjectModel(RoutinePlanSchema.name)
    private routinePlanModel: Model<RoutinePlanSchema>,
    @InjectModel(WorkoutSession.name)
    private workoutSessionModel: Model<WorkoutSession>,
    private readonly validator: WeekLogValidator,
    private routineDayService: RoutineDayService,
  ) {}

  async create(createWeekLogInput: CreateWeekLogInput, userId: Types.ObjectId) {
    const { startDate, endDate, planId } = createWeekLogInput;

    await this.validator.validateCreation(
      createWeekLogInput,
      userId,
      this.weekLogModel,
    );

    let plan: any = null;
    if (planId) {
      plan = await this.routinePlanModel
        .findById(planId)
        .populate('week.day')
        .lean()
        .exec();
    }

    const weekLogId = new Types.ObjectId();
    const { days, sessionsToInsert } = this.createInitialDaysAndSessions(
      userId.toString(),
      weekLogId.toString(),
      startDate,
      plan,
    );

    if (sessionsToInsert.length > 0) {
      await this.workoutSessionModel.insertMany(sessionsToInsert);
    }

    const weekLog = new this.weekLogModel({
      _id: weekLogId,
      userId,
      startDate,
      endDate,
      planId: planId ? new Types.ObjectId(planId) : null,
      days,
      completed: false,
      active: true,
    });

    await weekLog.save();
    return this.findOne(weekLog._id.toString(), userId.toString());
  }

  async findAllByUser(userId: string): Promise<any[]> {
    const weekLogs = await this.weekLogModel
      .find({ userId })
      .populate('days.workoutSessionId')
      .exec();

    return weekLogs.map((wl) => this.mapWeekLog(wl));
  }

  async findOne(id: string, userId: string): Promise<any> {
    const weekLog = await this.weekLogModel
      .findOne({ _id: id, userId })
      .populate('days.workoutSessionId')
      .exec();

    if (!weekLog) {
      throw new NotFoundException(`Week log con ID "${id}" no encontrado`);
    }

    return this.mapWeekLog(weekLog);
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

    return {
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
  }

  async update(
    id: string,
    updateWeekLogInput: UpdateWeekLogInput,
    userId: string,
  ) {
    const weekLog = await this.weekLogModel.findById(id);
    if (!weekLog) throw new NotFoundException(`WeekLog ${id} not found`);

    this.validator.validateOwnership(weekLog, userId);
    this.validator.validateUpdate(updateWeekLogInput);

    this.applyUpdateInput(weekLog, updateWeekLogInput);

    await weekLog.save();
    return this.findOne(id, userId);
  }

  async updateDay(input: UpdateWeekLogDayInput, userId: string) {
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

  private createInitialDaysAndSessions(
    userId: string,
    weekLogId: string,
    startDate: Date,
    plan?: any,
  ) {
    const sessionsToInsert: any[] = [];
    let isRestMap: boolean[] = new Array(7).fill(false);

    if (plan?.week?.length === 7) {
      isRestMap = plan.week.map((d) => d.isRest);
    }

    const days = Array.from({ length: 7 }).map((_, index) => {
      let workoutSessionId: Types.ObjectId | null = null;

      if (plan && plan.week && plan.week.length === 7 && !isRestMap[index]) {
        const planDay = plan.week[index];
        if (planDay && planDay.day) {
          const routineDay = planDay.day;
          const exercises =
            routineDay.exercises?.map((e: any) => ({
              exerciseId: (
                e.exercise._id ||
                e.exercise.id ||
                e.exercise
              ).toString(),
              series: 0,
              sets: [],
            })) || [];

          const sessionObjectId = new Types.ObjectId();
          workoutSessionId = sessionObjectId;
          sessionsToInsert.push({
            _id: sessionObjectId,
            userId,
            weekLogId,
            date: addDays(startDate, index),
            routineDayId: routineDay._id.toString(),
            exercises,
            status: 'not_started',
          });
        }
      }

      return {
        order: index + 1,
        date: addDays(startDate, index),
        isRest: isRestMap[index] ?? false,
        workoutSessionId,
        extraSessionIds: [],
        status: 'pending',
      };
    });

    return { days, sessionsToInsert };
  }

  private applyUpdateInput(
    weekLog: WeekLog,
    updateInput: UpdateWeekLogInput,
  ): void {
    if (updateInput.startDate)
      weekLog.startDate = parseISO(updateInput.startDate);
    if (updateInput.endDate) weekLog.endDate = parseISO(updateInput.endDate);
    if (updateInput.planId !== undefined)
      weekLog.planId = updateInput.planId
        ? new Types.ObjectId(updateInput.planId)
        : undefined;
    if (updateInput.notes !== undefined) weekLog.notes = updateInput.notes;
    if (updateInput.active !== undefined) weekLog.active = updateInput.active;

    if (updateInput.days?.length) {
      for (const dayInput of updateInput.days) {
        const day = weekLog.days.find((d) => d.order === dayInput.order);
        if (!day) continue;

        if (dayInput.workoutSessionId !== undefined) {
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

    await this.workoutSessionModel.findByIdAndUpdate(workoutSessionId, {
      deleted: true,
      deletedAt: new Date(),
    });

    return this.findOne(weekLog._id.toString(), userId);
  }

  async assignRoutineToDay(
    routineDayId: string,
    date: string,
    userId: string,
  ): Promise<any> {
    const routineDay = await this.routineDayService.findOne(routineDayId);
    if (!routineDay) {
      throw new NotFoundException(
        `RoutineDay con ID "${routineDayId}" no encontrado`,
      );
    }

    const weekLog = await this.findActiveWeekLog(userId);
    if (!weekLog) {
      throw new BadRequestException('No hay un WeekLog activo para el usuario');
    }

    const searchDate = new Date(date);
    const nextDay = new Date(searchDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const existingSession = await this.workoutSessionModel
      .findOne({
        userId: new Types.ObjectId(userId),
        deleted: { $ne: true },
        date: {
          $gte: searchDate,
          $lt: nextDay,
        },
      })
      .exec();

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

    if (existingSession) {
      existingSession.exercises = exercises;
      existingSession.routineDayId = routineDayId;
      existingSession.status = 'not_started';
      await existingSession.save();
      sessionId = existingSession._id;
    } else {
      const newSession = await this.workoutSessionModel.create({
        userId: new Types.ObjectId(userId),
        weekLogId: weekLog.id,
        date: searchDate,
        routineDayId,
        exercises,
        status: 'not_started',
        notes: '',
      });
      sessionId = newSession._id;
    }

    const dayToUpdate = weekLog.days.find((d: any) =>
      isSameDay(new Date(d.date), searchDate),
    );

    if (dayToUpdate) {
      await this.weekLogModel.updateOne(
        { _id: weekLog.id, 'days.order': dayToUpdate.order },
        {
          $set: {
            'days.$.workoutSessionId': sessionId,
            'days.$.status': 'complete',
          },
        },
      );
    }

    return this.weekLogModel.findById(weekLog.id);
  }
}
