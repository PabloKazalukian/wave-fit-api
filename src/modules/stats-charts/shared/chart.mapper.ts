import { Types } from 'mongoose';
import { ChartWorkoutSession } from './chart.types';

export function idToString(value: unknown): string {
  if (value instanceof Types.ObjectId) return value.toString();
  return String(value);
}

export function toChartWorkoutSession(raw: Record<string, any>): ChartWorkoutSession {
  return {
    _id: idToString(raw._id),
    userId: idToString(raw.userId),
    date: raw.date as Date,
    status: raw.status as string,
    exercises: (raw.exercises ?? []).map((ep: Record<string, any>) => ({
      exerciseId: idToString(ep.exerciseId),
      series: ep.series as number,
      sets: (ep.sets ?? []).map((s: Record<string, any>) => ({
        reps: s.reps as number,
        weights: s.weights as number | undefined,
      })),
    })),
  };
}