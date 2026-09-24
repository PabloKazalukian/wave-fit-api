import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExerciseCategory } from '../../routines/templates/exercise/entities/exercise.entity';
import { LocalDate } from '../../../common/utils/date.utils';
import { buildWeekKeys, isoWeekKeyFor, rangeUtcBounds } from '../common/range.utils';
import { idToString, toChartWorkoutSession } from '../shared/chart.mapper';
import { STATS_CHARTS_MIN_SETS_PER_WEEK } from '../stats-charts.config';
import { ForgottenMuscle } from '../presentation/entities/forgotten-muscle.output';
import {
  RawChartExercise,
  RawChartWorkoutSession,
} from './one-rm-weekly.calculator';

export interface RawChartWeekLog {
  _id: unknown;
  userId: unknown;
  planId?: unknown | null;
  active: boolean;
  deleted?: boolean;
}

export interface RawChartDayLog {
  _id: unknown;
  userId: unknown;
  planId?: unknown | null;
  routineDayId?: unknown | null;
  active: boolean;
  deleted?: boolean;
}

export interface RawChartRoutinePlan {
  _id: unknown;
  week: Array<{ day?: unknown | null; isRest: boolean; order: number }>;
}

export interface RawChartRoutineDay {
  _id: unknown;
  title: string;
  type: string[];
}

interface MuscleStats {
  totalSets: number;
  weeklySets: Map<string, number>;
  lastTrainedAt: Date | null;
}

const FALLBACK_CATALOG = (Object.values(ExerciseCategory) as ExerciseCategory[]).filter(
  (category) => category !== ExerciseCategory.REST,
);

@Injectable()
export class ForgottenMusclesCalculator {
  constructor(
    @InjectModel('StatsChartsWorkoutSession')
    private readonly workoutSessionModel: Model<RawChartWorkoutSession>,
    @InjectModel('StatsChartsExercise')
    private readonly exerciseModel: Model<RawChartExercise>,
    @InjectModel('StatsChartsWeekLog')
    private readonly weekLogModel: Model<RawChartWeekLog>,
    @InjectModel('StatsChartsDayLog')
    private readonly dayLogModel: Model<RawChartDayLog>,
    @InjectModel('StatsChartsRoutinePlan')
    private readonly routinePlanModel: Model<RawChartRoutinePlan>,
    @InjectModel('StatsChartsRoutineDay')
    private readonly routineDayModel: Model<RawChartRoutineDay>,
  ) {}

  async execute(
    userId: string,
    from: LocalDate,
    to: LocalDate,
    timezone: string,
  ): Promise<ForgottenMuscle[]> {
    const { fromUtc, toUtc } = rangeUtcBounds(from, to, timezone);
    const weekKeys = buildWeekKeys(from, to, timezone);

    const [sessions, exercises, activeWeekLogs, activeDayLogs] = await Promise.all([
      this.workoutSessionModel
        .find({
          userId: userId as any,
          deleted: { $ne: true },
          status: 'complete',
          date: { $gte: fromUtc, $lt: toUtc },
        })
        .sort({ date: 1 })
        .lean()
        .exec(),
      this.exerciseModel.find().lean().exec(),
      this.weekLogModel
        .find({ userId: userId as any, active: true, deleted: { $ne: true } })
        .lean()
        .exec(),
      this.dayLogModel
        .find({ userId: userId as any, active: true, deleted: { $ne: true } })
        .lean()
        .exec(),
    ]);

    const exercisesById = new Map<string, RawChartExercise>();
    for (const exercise of exercises) {
      exercisesById.set(idToString(exercise._id), exercise);
    }

    const planIds = activeWeekLogs
      .map((weekLog) => weekLog.planId)
      .filter((planId) => Boolean(planId));
    const dayLogRoutineDayIds = activeDayLogs
      .map((dayLog) => dayLog.routineDayId)
      .filter((routineDayId) => Boolean(routineDayId));

    let routineDayIds: unknown[] = [...dayLogRoutineDayIds];
    if (planIds.length > 0) {
      const plans = await this.routinePlanModel
        .find({ _id: { $in: planIds } } as any)
        .lean()
        .exec();
      for (const plan of plans) {
        for (const weekDay of plan.week ?? []) {
          if (!weekDay.isRest && weekDay.day) routineDayIds.push(weekDay.day);
        }
      }
    }

    const expectedMuscles: string[] = [];
    if (routineDayIds.length > 0) {
      const routineDays = await this.routineDayModel
        .find({ _id: { $in: routineDayIds } } as any)
        .lean()
        .exec();
      for (const routineDay of routineDays) {
        for (const category of routineDay.type ?? []) {
          if (!expectedMuscles.includes(category)) expectedMuscles.push(category);
        }
      }
    }

    const candidates: string[] =
      expectedMuscles.length > 0 ? expectedMuscles : [...FALLBACK_CATALOG];

    const byMuscle = new Map<string, MuscleStats>();
    for (const raw of sessions) {
      const session = toChartWorkoutSession(raw);
      const weekKey = isoWeekKeyFor(session.date, timezone);
      for (const performance of session.exercises ?? []) {
        const exercise = exercisesById.get(performance.exerciseId);
        if (!exercise) continue;
        const muscle = (exercise.category as ExerciseCategory) ?? ExerciseCategory.REST;
        if (muscle === ExerciseCategory.REST) continue;

        for (const set of performance.sets ?? []) {
          if (set.reps < 1) continue;
          const stats = byMuscle.get(muscle) ?? {
            totalSets: 0,
            weeklySets: new Map<string, number>(),
            lastTrainedAt: null,
          };
          stats.totalSets += 1;
          stats.weeklySets.set(weekKey, (stats.weeklySets.get(weekKey) ?? 0) + 1);
          if (!stats.lastTrainedAt || session.date > stats.lastTrainedAt) {
            stats.lastTrainedAt = session.date;
          }
          byMuscle.set(muscle, stats);
        }
      }
    }

    const failureThreshold = STATS_CHARTS_MIN_SETS_PER_WEEK * weekKeys.length;

    const result: ForgottenMuscle[] = [];
    for (const muscle of candidates) {
      const stats = byMuscle.get(muscle);
      const totalSets = stats?.totalSets ?? 0;
      if (totalSets >= failureThreshold) continue;

      const weeksWithoutWork = weekKeys.filter(
        (weekKey) => (stats?.weeklySets.get(weekKey) ?? 0) === 0,
      ).length;

      result.push({
        muscle,
        totalSets,
        weeksWithoutWork,
        lastTrainedAt: stats?.lastTrainedAt ?? null,
      });
    }

    result.sort(
      (a, b) =>
        a.totalSets - b.totalSets ||
        b.weeksWithoutWork - a.weeksWithoutWork ||
        (a.lastTrainedAt?.getTime() ?? Number.POSITIVE_INFINITY) -
          (b.lastTrainedAt?.getTime() ?? Number.POSITIVE_INFINITY),
    );

    return result;
  }
}