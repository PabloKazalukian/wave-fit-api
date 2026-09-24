import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExerciseCategory } from '../../routines/templates/exercise/entities/exercise.entity';
import { LocalDate } from '../../../common/utils/date.utils';
import { buildWeekKeys, isoWeekKeyFor, rangeUtcBounds } from '../common/range.utils';
import { idToString, toChartWorkoutSession } from '../shared/chart.mapper';
import {
  MuscleVolume,
  VolumeWeeklyEntry,
  ExerciseVolume,
} from '../presentation/entities/volume-weekly.output';
import {
  RawChartExercise,
  RawChartWorkoutSession,
} from './one-rm-weekly.calculator';

interface ExerciseAccumulator {
  exerciseId: string;
  volume: number;
}

interface MuscleAccumulator {
  muscle: string;
  sets: number;
  volume: number;
}

@Injectable()
export class VolumeWeeklyCalculator {
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
  ): Promise<VolumeWeeklyEntry[]> {
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

    const exercisesById = new Map<string, RawChartExercise>();
    for (const exercise of exercises) {
      exercisesById.set(idToString(exercise._id), exercise);
    }

    const byWeek = new Map<string, { exercises: Map<string, ExerciseAccumulator>; muscles: Map<string, MuscleAccumulator> }>();

    for (const raw of sessions) {
      const session = toChartWorkoutSession(raw);
      const weekKey = isoWeekKeyFor(session.date, timezone);
      const entry = byWeek.get(weekKey) ?? {
        exercises: new Map<string, ExerciseAccumulator>(),
        muscles: new Map<string, MuscleAccumulator>(),
      };

      for (const performance of session.exercises ?? []) {
        const exercise = exercisesById.get(performance.exerciseId);
        const muscle = (exercise?.category as ExerciseCategory) ?? ExerciseCategory.REST;
        const accumulator = entry.exercises.get(performance.exerciseId) ?? {
          exerciseId: performance.exerciseId,
          volume: 0,
        };
        const muscleAccumulator = entry.muscles.get(muscle) ?? {
          muscle,
          sets: 0,
          volume: 0,
        };

        for (const set of performance.sets ?? []) {
          const volume = set.weights !== undefined && set.weights > 0 ? set.reps * set.weights : 0;
          accumulator.volume += volume;
          if (set.reps >= 1) {
            muscleAccumulator.sets += 1;
            muscleAccumulator.volume += volume;
          }
        }

        entry.exercises.set(performance.exerciseId, accumulator);
        entry.muscles.set(muscle, muscleAccumulator);
      }

      byWeek.set(weekKey, entry);
    }

    return weekKeys.map((weekKey) => {
      const entry = byWeek.get(weekKey);
      if (!entry) {
        return { weekKey, exercises: [], muscles: [] };
      }

      const exercisesOutput: ExerciseVolume[] = [...entry.exercises.values()]
        .map((acc) => {
          const exercise = exercisesById.get(acc.exerciseId);
          return {
            exerciseId: acc.exerciseId,
            name: exercise?.name ?? acc.exerciseId,
            category: (exercise?.category as ExerciseCategory) ?? ExerciseCategory.REST,
            volume: acc.volume,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      const musclesOutput: MuscleVolume[] = [...entry.muscles.values()]
        .sort((a, b) => a.muscle.localeCompare(b.muscle));

      return { weekKey, exercises: exercisesOutput, muscles: musclesOutput };
    });
  }
}