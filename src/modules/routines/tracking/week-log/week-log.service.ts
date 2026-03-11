import {
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
import { RoutinePlanService } from '../../templates/routine-plan/routine-plan.service';

@Injectable()
export class WeekLogService {
  constructor(
    @InjectModel(WeekLog.name) private weekLogModel: Model<WeekLog>,
    private routinePlanSv: RoutinePlanService,
    @InjectModel(WorkoutSession.name)
    private workoutSessionModel: Model<WorkoutSession>,
    private readonly validator: WeekLogValidator,
  ) {}

  async create(createWeekLogInput: CreateWeekLogInput, userId: Types.ObjectId) {
    const { startDate, endDate, planId } = createWeekLogInput;

    await this.validator.validateCreation(
      createWeekLogInput,
      userId,
      this.weekLogModel,
    );

    let isRestMap: boolean[] = new Array(7).fill(false);
    let plan: any = null;

    if (planId) {
      plan = await this.routinePlanSv.findOne(planId);

      if (plan?.week?.length === 7) {
        isRestMap = plan.week.map((d) => d.isRest);
      }
    }

    const weekLogId = new Types.ObjectId();
    const sessionsToInsert: any[] = [];

    const days = Array.from({ length: 7 }).map((_, index) => {
      let workoutSessionId: Types.ObjectId | null = null;

      if (plan && plan.week && plan.week.length === 7 && !isRestMap[index]) {
        const planDay = plan.week[index];
        if (planDay && planDay.day) {
          const routineDay = planDay.day;
          const exercises = routineDay.exercises?.map((e: any) => ({
            exerciseId: (e.exercise._id || e.exercise.id || e.exercise).toString(),
            series: 0,
            sets: [],
          })) || [];

          const sessionObjectId = new Types.ObjectId();
          workoutSessionId = sessionObjectId;
          sessionsToInsert.push({
            _id: sessionObjectId,
            userId: userId.toString(),
            weekLogId: weekLogId.toString(),
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
    });

    return weekLog.save();
  }

  async findAllByUser(userId: string): Promise<WeekLog[] | undefined> {
    return this.weekLogModel.find({ userId }).exec();
  }

  async findOne(
    id: string,
    userId: string,
  ): Promise<WeekLog | null | undefined> {
    const weekLog = await this.weekLogModel.findOne({ _id: id, userId }).exec();

    if (!weekLog) {
      throw new NotFoundException(`Week log con ID "${id}" no encontrado`);
    }

    return weekLog;
  }

  // async findActiveWeekLog(userId: string): Promise<WeekLog | null> {
  //   const weekLog = await this.weekLogModel
  //     .findOne({ userId, completed: false })
  //     .exec();

  //   return weekLog;
  // }

  async findActiveWeekLog(userId: string): Promise<any | null> {
    const weekLog = await this.weekLogModel
      .findOne({ userId, completed: false })
      .populate('days.workoutSessionId')
      .exec();

    if (!weekLog) return null;

    const weekLogObj = weekLog.toObject();

    return {
      ...weekLogObj,
      id: weekLogObj._id.toString(), // 👈 esto es lo que falta
      days: weekLogObj.days.map((day) => {
        const session = day.workoutSessionId as any;
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

    if (updateWeekLogInput.startDate)
      weekLog.startDate = parseISO(updateWeekLogInput.startDate);
    if (updateWeekLogInput.endDate)
      weekLog.endDate = parseISO(updateWeekLogInput.endDate);
    if (updateWeekLogInput.planId !== undefined)
      weekLog.planId = updateWeekLogInput.planId
        ? new Types.ObjectId(updateWeekLogInput.planId)
        : undefined;
    if (updateWeekLogInput.notes !== undefined)
      weekLog.notes = updateWeekLogInput.notes;
    if (updateWeekLogInput.completed !== undefined)
      weekLog.completed = updateWeekLogInput.completed;

    // ✅ Actualizar días individualmente por order
    if (updateWeekLogInput.days?.length) {
      for (const dayInput of updateWeekLogInput.days) {
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

    return weekLog.save();
  }

  async updateDay(input: UpdateWeekLogDayInput, userId: string) {
    const weekLog = await this.weekLogModel.findById(input.workoutSessionId);

    if (!weekLog) throw new NotFoundException('WeekLog not found');

    this.validator.validateOwnership(weekLog, userId);

    const day = weekLog.days.find((d) => d.order === input.order);

    if (!day) throw new NotFoundException('Day not found');

    if (input.status) day.status = input.status;

    await weekLog.save();

    return weekLog;
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

    return weekLog;
  }

  async syncDaysWithSessions(weekLogId: string, userId: string) {
    const weekLog = await this.findOne(weekLogId, userId);
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
      await (weekLog as any).save();
    }

    return weekLog;
  }

  remove(id: string) {
    return this.weekLogModel.deleteOne({ _id: id }).exec();
  }
}
