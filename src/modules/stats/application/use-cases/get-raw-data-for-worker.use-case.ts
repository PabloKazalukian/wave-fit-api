import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  WorkoutSession,
  WorkoutSessionDocument,
} from '../../infrastructure/schemas/workout-session-reference.schema';
import {
  WeekLog,
  WeekLogDocument,
} from '../../infrastructure/schemas/week-log-reference.schema';
import {
  Exercise,
  ExerciseDocument,
} from '../../infrastructure/schemas/exercise-reference.schema';
import {
  RoutinePlan,
  RoutinePlanDocument,
} from '../../infrastructure/schemas/routine-plan-reference.schema';
import {
  UserStrengthMetric,
  UserStrengthMetricDocument,
} from '../../infrastructure/schemas/strength-metric-reference.schema';
import { WorkerRawDataDomain } from '../../domain/entities/stats.domain';

@Injectable()
export class GetRawDataForWorkerUseCase {
  constructor(
    @InjectModel(WorkoutSession.name)
    private readonly workoutSessionModel: Model<WorkoutSessionDocument>,
    @InjectModel(WeekLog.name)
    private readonly weekLogModel: Model<WeekLogDocument>,
    @InjectModel(Exercise.name)
    private readonly exerciseModel: Model<ExerciseDocument>,
    @InjectModel(RoutinePlan.name)
    private readonly routinePlanModel: Model<RoutinePlanDocument>,
    @InjectModel(UserStrengthMetric.name)
    private readonly strengthMetricModel: Model<UserStrengthMetricDocument>,
  ) {}

  async execute(userId: string): Promise<WorkerRawDataDomain> {
    const userObjectId = new Types.ObjectId(userId);

    const [workoutSessions, weekLogs, exercises, routinePlans, strengthMetrics] =
      await Promise.all([
        this.workoutSessionModel
          .find({
            userId: userObjectId,
            deleted: { $ne: true },
            status: 'complete',
          })
          .sort({ date: 1 })
          .lean()
          .exec(),

        this.weekLogModel
          .find({
            userId: userObjectId,
            deleted: { $ne: true },
          })
          .sort({ startDate: 1 })
          .lean()
          .exec(),

        this.exerciseModel.find().lean().exec(),

        this.routinePlanModel
          .find({ createdBy: userObjectId })
          .lean()
          .exec(),

        this.strengthMetricModel
          .find({ userId: userObjectId })
          .sort({ measuredAt: 1 })
          .lean()
          .exec(),
      ]);

    return {
      workoutSessions: workoutSessions.map((ws) => ({
        _id: ws._id.toString(),
        userId: ws.userId.toString(),
        date: ws.date,
        routineDayId: ws.routineDayId?.toString(),
        status: ws.status,
        exercises: (ws.exercises ?? []).map((ep) => ({
          exerciseId: ep.exerciseId.toString(),
          series: ep.series,
          sets: (ep.sets ?? []).map((s) => ({
            reps: s.reps,
            weights: s.weights,
          })),
        })),
      })),

      weekLogs: weekLogs.map((wl) => ({
        _id: wl._id.toString(),
        userId: wl.userId.toString(),
        startDate: wl.startDate,
        endDate: wl.endDate,
        planId: wl.planId?.toString(),
        completed: wl.completed,
        days: (wl.days ?? []).map((d) => ({
          order: d.order,
          date: d.date,
          isRest: d.isRest,
          status: d.status,
        })),
      })),

      exercises: exercises.map((e) => ({
        _id: e._id.toString(),
        name: e.name,
        category: e.category,
        usesWeight: e.usesWeight,
      })),

      routinePlans: routinePlans.map((rp) => ({
        _id: rp._id.toString(),
        name: rp.name,
        description: rp.description,
        createdBy: rp.createdBy?.toString(),
      })),

      strengthMetrics: strengthMetrics.map((sm) => ({
        _id: sm._id.toString(),
        exerciseKey: sm.exerciseKey,
        oneRmKg: sm.oneRmKg,
        measuredAt: sm.measuredAt,
      })),
    };
  }
}
