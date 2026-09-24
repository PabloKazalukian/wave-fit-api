import { STATS_CHARTS_MAX_1RM_REPS } from '../stats-charts.config';
import { isoWeekKeyFor } from './range.utils';
import { ChartWorkoutSession } from '../shared/chart.types';

export function estimateOneRmEpley(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

export function isEligibleOneRmSet(
  reps: number,
  weight: number | undefined,
  maxReps: number = STATS_CHARTS_MAX_1RM_REPS,
): boolean {
  return reps >= 1 && reps <= maxReps && (weight ?? 0) > 0;
}

export interface WeeklyBestOneRm {
  best1RM: number;
  weightUsed: number;
  reps: number;
}

export type WeeklyBestOneRmMap = Map<string, Map<string, WeeklyBestOneRm>>;

export function buildWeeklyBestOneRmMap(
  sessions: ChartWorkoutSession[],
  timezone: string,
  maxReps: number = STATS_CHARTS_MAX_1RM_REPS,
): WeeklyBestOneRmMap {
  const map: WeeklyBestOneRmMap = new Map();

  for (const session of sessions) {
    const weekKey = isoWeekKeyFor(session.date, timezone);
    for (const performance of session.exercises ?? []) {
      const currentByWeek = map.get(performance.exerciseId) ?? new Map<string, WeeklyBestOneRm>();

      for (const set of performance.sets ?? []) {
        if (!isEligibleOneRmSet(set.reps, set.weights, maxReps)) continue;
        const oneRm = estimateOneRmEpley(set.weights!, set.reps);
        const current = currentByWeek.get(weekKey);

        const tiesOnWeight =
          current &&
          current.best1RM === oneRm &&
          (set.weights! > current.weightUsed ||
            (set.weights! === current.weightUsed && set.reps > current.reps));

        if (!current || oneRm > current.best1RM || tiesOnWeight) {
          currentByWeek.set(weekKey, {
            best1RM: oneRm,
            weightUsed: set.weights!,
            reps: set.reps,
          });
        }
      }

      if (currentByWeek.size > 0) {
        map.set(performance.exerciseId, currentByWeek);
      }
    }
  }

  return map;
}