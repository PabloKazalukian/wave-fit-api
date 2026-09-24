import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LocalDate } from '../../../common/utils/date.utils';
import { buildWeekKeys, isoWeekKeyFor, rangeUtcBounds } from '../common/range.utils';

import { EXTRA_SESSION_DISCIPLINES } from '../../routines/tracking/extra-session/extra-session.catalog';
import { CaloriesWeeklyEntry } from '../presentation/entities/calories-weekly.output';

export interface RawChartExtraSession {
  _id: unknown;
  userId: unknown;
  discipline: string;
  date: Date;
  duration: number;
  calories?: number | null;
}

export interface RawChartWeightLog {
  _id: unknown;
  userId: unknown;
  weightKg: number;
  loggedAt: Date;
}

export interface RawChartUserProfile {
  userId: unknown;
  weightKg?: number | null;
}

@Injectable()
export class CaloriesCalculator {
  constructor(
    @InjectModel('StatsChartsExtraSession')
    private readonly extraSessionModel: Model<RawChartExtraSession>,
    @InjectModel('StatsChartsUserWeightLog')
    private readonly weightLogModel: Model<RawChartWeightLog>,
    @InjectModel('StatsChartsUserProfile')
    private readonly userProfileModel: Model<RawChartUserProfile>,
  ) {}

  async execute(
    userId: string,
    from: LocalDate,
    to: LocalDate,
    timezone: string,
  ): Promise<CaloriesWeeklyEntry[]> {
    const { fromUtc, toUtc } = rangeUtcBounds(from, to, timezone);
    const weekKeys = buildWeekKeys(from, to, timezone);

    const [extras, weightLogs, profile] = await Promise.all([
      this.extraSessionModel
        .find({
          userId: userId as any,
          deleted: { $ne: true },
          date: { $gte: fromUtc, $lt: toUtc },
        })
        .lean()
        .exec(),
      this.weightLogModel
        .find({ userId: userId as any, loggedAt: { $lte: toUtc } })
        .sort({ loggedAt: 1 })
        .lean()
        .exec(),
      this.userProfileModel.findOne({ userId: userId as any }).lean().exec(),
    ]);

    const sortedLogs = [...weightLogs].sort(
      (a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime(),
    );

    const extrasByDate = [...extras].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    const byWeek = new Map<string, { extraKcal: number; estimatedSessions: number }>();

    let logIndex = -1;
    for (const raw of extrasByDate) {
      const sessionDate = new Date(raw.date);
      while (
        sortedLogs[logIndex + 1] &&
        new Date(sortedLogs[logIndex + 1].loggedAt).getTime() <= sessionDate.getTime()
      ) {
        logIndex += 1;
      }
      const weightKg =
        sortedLogs[logIndex]?.weightKg ??
        (profile && profile.weightKg ? profile.weightKg : null);

      const weekKey = isoWeekKeyFor(sessionDate, timezone);
      const entry = byWeek.get(weekKey) ?? { extraKcal: 0, estimatedSessions: 0 };

      const manual = raw.calories !== null && raw.calories !== undefined;
      if (manual) {
        entry.extraKcal += raw.calories ?? 0;
      } else {
        const met = EXTRA_SESSION_DISCIPLINES[raw.discipline as keyof typeof EXTRA_SESSION_DISCIPLINES]?.met ?? 0;
        if (weightKg !== null && met > 0) {
          entry.extraKcal += met * weightKg * (raw.duration / 60);
          entry.estimatedSessions += 1;
        }
      }

      byWeek.set(weekKey, entry);
    }

    return weekKeys.map((weekKey) => {
      const entry = byWeek.get(weekKey);
      const extraKcal = entry?.extraKcal ?? 0;
      const estimatedSessions = entry?.estimatedSessions ?? 0;
      return {
        weekKey,
        routineKcal: null,
        extraKcal,
        totalKcal: extraKcal,
        estimatedSessions,
      };
    });
  }
}