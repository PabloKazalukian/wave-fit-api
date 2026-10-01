import { Test, type TestingModule } from '@nestjs/testing';
import {
  getModelToken,
  getConnectionToken,
  MongooseModule,
  type MongooseModuleOptions,
} from '@nestjs/mongoose';
import type { Connection, Model } from 'mongoose';
import type { EventEmitter } from 'node:events';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { StatsChartsModule } from '../../../src/modules/stats-charts/stats-charts.module';
import { OneRmWeeklyCalculator } from '../../../src/modules/stats-charts/calculators/one-rm-weekly.calculator';
import { VolumeWeeklyCalculator } from '../../../src/modules/stats-charts/calculators/volume-weekly.calculator';
import { VolumeTotalWeeklyCalculator } from '../../../src/modules/stats-charts/calculators/volume-total.calculator';
import { CaloriesCalculator } from '../../../src/modules/stats-charts/calculators/calories.calculator';
import { ForgottenMusclesCalculator } from '../../../src/modules/stats-charts/calculators/forgotten-muscles.calculator';
import { TrendCalculator } from '../../../src/modules/stats-charts/calculators/trend.calculator';
import { QueryMetricsCollector } from '../metrics/query-metrics';
import type { PerfDataset } from './perf-dataset';

export interface PerfCalculators {
  oneRmWeekly: OneRmWeeklyCalculator;
  volumeWeekly: VolumeWeeklyCalculator;
  volumeTotalWeekly: VolumeTotalWeeklyCalculator;
  caloriesWeekly: CaloriesCalculator;
  forgottenMuscles: ForgottenMusclesCalculator;
  exerciseTrend: TrendCalculator;
}

export interface PerfHarness {
  uri: string;
  /** Exposed so the seed can resolve the aliased models. */
  moduleRef: TestingModule;
  calculators: PerfCalculators;
  collector: QueryMetricsCollector;
  close(): Promise<void>;
}

/**
 * Boots an in-memory MongoDB with the real `StatsChartsModule`, so the bench
 * exercises the production Mongoose models, the real schema indexes and the
 * real `.lean()` read path. Nothing is mocked: `docsReturned` therefore counts
 * documents that genuinely crossed the wire.
 *
 * The root connection is built here instead of via `test/utils/db-handler.ts`
 * because the driver only emits `commandStarted` / `commandSucceeded` when the
 * connection is opened with `monitorCommands: true`, and Mongoose ignores
 * connection options once a connection is already open. The perf layer is the
 * only consumer of those events, so the option stays local to it.
 *
 * The module is composed here rather than added to
 * `test/utils/app-test.module.ts` on purpose: the E2E module must not gain a
 * feature-specific dependency.
 */
export async function createPerfHarness(): Promise<PerfHarness> {
  const mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [
      MongooseModule.forRoot(uri, {
        monitorCommands: true,
      } as MongooseModuleOptions),
      StatsChartsModule,
    ],
  }).compile();

  await moduleRef.init();

  const connection = moduleRef.get<Connection>(getConnectionToken());
  const client = connection.getClient();
  if (!client) {
    await moduleRef.close();
    await mongoServer.stop();
    throw new Error(
      'Mongoose connection is not open; command metrics are unavailable.',
    );
  }

  const collector = new QueryMetricsCollector(
    client as unknown as EventEmitter,
  );

  const calculators: PerfCalculators = {
    oneRmWeekly: moduleRef.get(OneRmWeeklyCalculator),
    volumeWeekly: moduleRef.get(VolumeWeeklyCalculator),
    volumeTotalWeekly: moduleRef.get(VolumeTotalWeeklyCalculator),
    caloriesWeekly: moduleRef.get(CaloriesCalculator),
    forgottenMuscles: moduleRef.get(ForgottenMusclesCalculator),
    exerciseTrend: moduleRef.get(TrendCalculator),
  };

  return {
    uri,
    moduleRef,
    calculators,
    collector,
    close: async () => {
      collector.stop();
      await moduleRef.close();
      await mongoServer.stop();
    },
  };
}

const COLLECTION_MODELS = {
  workoutSession: 'StatsChartsWorkoutSession',
  weekLog: 'StatsChartsWeekLog',
  dayLog: 'StatsChartsDayLog',
  extraSession: 'StatsChartsExtraSession',
  exercise: 'StatsChartsExercise',
  userWeightLog: 'StatsChartsUserWeightLog',
  routinePlan: 'StatsChartsRoutinePlan',
  routineDay: 'StatsChartsRoutineDay',
  userProfile: 'StatsChartsUserProfile',
} as const;

export interface SeededCounts {
  exercises: number;
  workoutSessions: number;
  extraSessions: number;
  userWeightLogs: number;
  userProfiles: number;
  routineDays: number;
  routinePlans: number;
  weekLogs: number;
  dayLogs: number;
}

const modelOf = <T>(
  moduleRef: TestingModule,
  key: keyof typeof COLLECTION_MODELS,
): Model<T> => moduleRef.get<Model<T>>(getModelToken(COLLECTION_MODELS[key]));

/**
 * Bulk-inserts the datasets through the real aliased models.
 *
 * Reused verbatim by `scripts/perf/seed-stats-charts.ts` (the k6 layer), which
 * is why it takes a `TestingModule` rather than reaching for globals. Exercises
 * are upserted because the catalog is global and shared by every size.
 */
export async function seedPerfDatasets(
  moduleRef: TestingModule,
  datasets: PerfDataset[],
): Promise<SeededCounts> {
  const workoutSessionModel = modelOf<any>(moduleRef, 'workoutSession');
  const extraSessionModel = modelOf<any>(moduleRef, 'extraSession');
  const weightLogModel = modelOf<any>(moduleRef, 'userWeightLog');
  const userProfileModel = modelOf<any>(moduleRef, 'userProfile');
  const routineDayModel = modelOf<any>(moduleRef, 'routineDay');
  const routinePlanModel = modelOf<any>(moduleRef, 'routinePlan');
  const weekLogModel = modelOf<any>(moduleRef, 'weekLog');
  const dayLogModel = modelOf<any>(moduleRef, 'dayLog');
  const exerciseModel = modelOf<any>(moduleRef, 'exercise');

  // Real schema indexes (e.g. `workoutsessions: { userId, date }`) must exist
  // before measuring, otherwise the bench would report collection-scan costs.
  await Promise.all([
    workoutSessionModel.init(),
    extraSessionModel.init(),
    weightLogModel.init(),
    userProfileModel.init(),
    routineDayModel.init(),
    routinePlanModel.init(),
    weekLogModel.init(),
    dayLogModel.init(),
    exerciseModel.init(),
  ]);

  const counts: SeededCounts = {
    exercises: 0,
    workoutSessions: 0,
    extraSessions: 0,
    userWeightLogs: 0,
    userProfiles: 0,
    routineDays: 0,
    routinePlans: 0,
    weekLogs: 0,
    dayLogs: 0,
  };

  for (const dataset of datasets) {
    if (counts.exercises === 0) {
      await exerciseModel.bulkWrite(
        dataset.exercises.map((exercise) => ({
          updateOne: {
            filter: { _id: exercise._id },
            update: { $set: exercise },
            upsert: true,
          },
        })),
      );
      counts.exercises = dataset.exercises.length;

      await routineDayModel.insertMany(dataset.routineDays);
      await routinePlanModel.insertMany([dataset.routinePlan]);
      counts.routineDays += dataset.routineDays.length;
      counts.routinePlans += 1;
    }

    await workoutSessionModel.insertMany(dataset.workoutSessions);
    await extraSessionModel.insertMany(dataset.extraSessions);
    await weightLogModel.insertMany(dataset.userWeightLogs);
    await userProfileModel.insertMany(dataset.userProfiles);
    await weekLogModel.insertMany([dataset.weekLog]);
    await dayLogModel.insertMany([dataset.dayLog]);

    counts.workoutSessions += dataset.workoutSessions.length;
    counts.extraSessions += dataset.extraSessions.length;
    counts.userWeightLogs += dataset.userWeightLogs.length;
    counts.userProfiles += dataset.userProfiles.length;
    counts.weekLogs += 1;
    counts.dayLogs += 1;
  }

  return counts;
}

export { COLLECTION_MODELS };
