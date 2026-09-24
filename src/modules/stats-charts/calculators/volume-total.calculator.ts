import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LocalDate } from '../../../common/utils/date.utils';
import { buildWeekKeys, isoWeekKeyFor, rangeUtcBounds } from '../common/range.utils';
import { toChartWorkoutSession } from '../shared/chart.mapper';
import { STATS_CHARTS_DELOAD_THRESHOLD_PCT } from '../stats-charts.config';
import { VolumeTotalWeeklyEntry } from '../presentation/entities/volume-total-weekly.output';
import { RawChartWorkoutSession } from './one-rm-weekly.calculator';

const EPSILON = 1e-9;

@Injectable()
export class VolumeTotalWeeklyCalculator {
  constructor(
    @InjectModel('StatsChartsWorkoutSession')
    private readonly workoutSessionModel: Model<RawChartWorkoutSession>,
  ) {}

  async execute(
    userId: string,
    from: LocalDate,
    to: LocalDate,
    timezone: string,
  ): Promise<VolumeTotalWeeklyEntry[]> {
    const { fromUtc, toUtc } = rangeUtcBounds(from, to, timezone);
    const weekKeys = buildWeekKeys(from, to, timezone);

    const sessions = await this.workoutSessionModel
      .find({
        userId: userId as any,
        deleted: { $ne: true },
        status: 'complete',
        date: { $gte: fromUtc, $lt: toUtc },
      })
      .sort({ date: 1 })
      .lean()
      .exec();

    const totalsByWeek = new Map<string, number>();
    for (const raw of sessions) {
      const session = toChartWorkoutSession(raw);
      const weekKey = isoWeekKeyFor(session.date, timezone);
      let total = totalsByWeek.get(weekKey) ?? 0;
      for (const performance of session.exercises ?? []) {
        for (const set of performance.sets ?? []) {
          total += set.weights !== undefined && set.weights > 0 ? set.reps * set.weights : 0;
        }
      }
      totalsByWeek.set(weekKey, total);
    }

    let previousTotal: number | null = null;
    return weekKeys.map((weekKey) => {
      const totalVolume = totalsByWeek.get(weekKey) ?? 0;
      let deltaPct: number | null = null;
      if (previousTotal !== null && previousTotal !== 0) {
        deltaPct = ((totalVolume - previousTotal) / previousTotal) * 100;
      }
      previousTotal = totalVolume;
      const possibleDeload =
        deltaPct !== null && deltaPct <= STATS_CHARTS_DELOAD_THRESHOLD_PCT + EPSILON;
      return { weekKey, totalVolume, deltaPct, possibleDeload };
    });
  }
}