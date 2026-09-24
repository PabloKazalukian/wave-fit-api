import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExerciseCategory } from '../../routines/templates/exercise/entities/exercise.entity';
import { LocalDate } from '../../../common/utils/date.utils';
import { buildWeekKeys, rangeUtcBounds } from '../common/range.utils';
import { buildWeeklyBestOneRmMap } from '../common/strength.utils';
import { idToString, toChartWorkoutSession } from '../shared/chart.mapper';
import { ExerciseTrend, TrendLabel } from '../presentation/entities/exercise-trend.output';
import {
  STATS_CHARTS_MIN_TREND_WEEKS,
  STATS_CHARTS_TREND_THRESHOLD_PCT,
} from '../stats-charts.config';
import {
  RawChartExercise,
  RawChartWorkoutSession,
} from './one-rm-weekly.calculator';

interface TrendPoint {
  x: number;
  y: number;
}

function leastSquaresSlope(points: TrendPoint[]): number {
  const n = points.length;
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / n;
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / n;
  let numerator = 0;
  let denominator = 0;
  for (const point of points) {
    numerator += (point.x - meanX) * (point.y - meanY);
    denominator += (point.x - meanX) ** 2;
  }
  return denominator === 0 ? 0 : numerator / denominator;
}

@Injectable()
export class TrendCalculator {
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
  ): Promise<ExerciseTrend[]> {
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

    const result: ExerciseTrend[] = [];

    for (const [exerciseId, byWeek] of bestMap) {
      const points: TrendPoint[] = [];
      const meanY: number[] = [];

      weekKeys.forEach((weekKey, index) => {
        const best = byWeek.get(weekKey);
        if (!best) return;
        points.push({ x: index, y: best.best1RM });
        meanY.push(best.best1RM);
      });

      const weeksUsed = points.length;
      const exercise = exercisesById.get(exerciseId);
      let slope: number | null = null;
      let pctChange: number | null = null;
      let label: TrendLabel;

      if (weeksUsed < STATS_CHARTS_MIN_TREND_WEEKS) {
        label = TrendLabel.INSUFFICIENT;
      } else {
        const avgY = meanY.reduce((sum, y) => sum + y, 0) / meanY.length;
        slope = leastSquaresSlope(points);
        pctChange = avgY === 0 ? 0 : (slope / avgY) * 100;
        if (pctChange > STATS_CHARTS_TREND_THRESHOLD_PCT) {
          label = TrendLabel.UP;
        } else if (pctChange < -STATS_CHARTS_TREND_THRESHOLD_PCT) {
          label = TrendLabel.DOWN;
        } else {
          label = TrendLabel.FLAT;
        }
      }

      result.push({
        exerciseId,
        name: exercise?.name ?? exerciseId,
        category: (exercise?.category as ExerciseCategory) ?? ExerciseCategory.REST,
        slope,
        pctChange,
        label,
        weeksUsed,
      });
    }

    result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }
}