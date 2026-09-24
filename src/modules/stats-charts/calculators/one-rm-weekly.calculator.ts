import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExerciseCategory } from '../../routines/templates/exercise/entities/exercise.entity';
import { LocalDate } from '../../../common/utils/date.utils';
import { buildWeekKeys, rangeUtcBounds } from '../common/range.utils';
import { idToString, toChartWorkoutSession } from '../shared/chart.mapper';
import { buildWeeklyBestOneRmMap } from '../common/strength.utils';
import { Exercise1RmWeekly, WeekOneRm } from '../presentation/entities/one-rm-weekly.output';

export interface RawChartWorkoutSessionExercise {
  exerciseId: unknown;
  series: number;
  sets: Array<{ reps: number; weights?: number }>;
}

export interface RawChartWorkoutSession {
  _id: unknown;
  userId: unknown;
  date: Date;
  status: string;
  exercises?: RawChartWorkoutSessionExercise[];
}

export interface RawChartExercise {
  _id: unknown;
  name: string;
  category: string;
  usesWeight?: boolean;
}

@Injectable()
export class OneRmWeeklyCalculator {
  constructor(
    @InjectModel('StatsChartsWorkoutSession')
    private readonly workoutSessionModel: Model<RawChartWorkoutSession>,
    @InjectModel('StatsChartsExercise')
    private readonly exerciseModel: Model<RawChartExercise>,
  ) {}

  async execute(
    userId: string,
    from: LocalDate,
    to: LocalDate,
    timezone: string,
  ): Promise<Exercise1RmWeekly[]> {
    const { fromUtc, toUtc } = rangeUtcBounds(from, to, timezone);
    const weekKeys = buildWeekKeys(from, to, timezone);

    const [sessions, exercises] = await Promise.all([
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
    ]);

    const bestMap = buildWeeklyBestOneRmMap(
      sessions.map((raw) => toChartWorkoutSession(raw)),
      timezone,
    );

    const exercisesById = new Map<string, RawChartExercise>();
    for (const exercise of exercises) {
      exercisesById.set(idToString(exercise._id), exercise);
    }

    const result: Exercise1RmWeekly[] = [];

    for (const [exerciseId, byWeek] of bestMap) {
      const exercise = exercisesById.get(exerciseId);
      const weeks: WeekOneRm[] = weekKeys.map((weekKey) => {
        const best = byWeek.get(weekKey);
        if (!best) {
          return { weekKey, best1RM: null, weightUsed: null, reps: null, participated: false };
        }
        return {
          weekKey,
          best1RM: best.best1RM,
          weightUsed: best.weightUsed,
          reps: best.reps,
          participated: true,
        };
      });

      result.push({
        exerciseId,
        name: exercise?.name ?? exerciseId,
        category: (exercise?.category as ExerciseCategory) ?? ExerciseCategory.REST,
        weeks,
      });
    }

    result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }
}