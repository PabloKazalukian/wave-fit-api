/**
 * Standalone seed script for the `stats-charts` performance layer (k6).
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/perf/seed-stats-charts.ts --uri mongodb://localhost:27017/wavefit-perf --size medium
 *
 * This script:
 * - Creates (or reuses) the perf user with credentials from env (PERF_USER_EMAIL, PERF_USER_PASSWORD).
 * - Deletes only documents belonging to that perf user, so it never touches unrelated data.
 * - Bulk-inserts the deterministic dataset through the real aliased StatsCharts* models.
 * - Is idempotent: running it twice yields the same document counts.
 */

import { Test } from '@nestjs/testing';
import {
  MongooseModule,
  getModelToken,
  getConnectionToken,
} from '@nestjs/mongoose';
import type { Model, Connection } from 'mongoose';
import { Types } from 'mongoose';
import type { Db } from 'mongodb';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';

import { StatsChartsModule } from '../../src/modules/stats-charts/stats-charts.module';
import {
  buildPerfDataset,
  type PerfSize,
  PERF_SIZES,
} from '../../test/perf/fixtures/perf-dataset';
import {
  seedPerfDatasets,
  COLLECTION_MODELS,
  type SeededCounts,
} from '../../test/perf/fixtures/perf-mongoose';
import { User, UserSchema } from '../../src/modules/user/schema/user.schema';

export interface SeedResult {
  size: PerfSize;
  uri: string;
  email: string;
  userId: string;
  counts: SeededCounts;
  readBack: Record<string, number>;
  fingerprint: string;
}

async function fingerprint(
  db: Db,
  collection: string,
  userId: Types.ObjectId,
  idOf: (doc: any) => string,
): Promise<string> {
  const docs = await db
    .collection(collection)
    .find({ userId })
    .sort({ _id: 1 })
    .toArray();
  return createHash('sha256').update(docs.map(idOf).join(',')).digest('hex');
}

const DEFAULT_URI = 'mongodb://localhost:27017/wavefit-perf';
const DEFAULT_SIZE: PerfSize = 'medium';

function parseArgs(args: string[]): { uri: string; size: PerfSize } {
  let uri = DEFAULT_URI;
  let size: PerfSize = DEFAULT_SIZE;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === '--uri' || arg === '-u') && args[i + 1]) {
      uri = args[i + 1];
      i += 1;
      continue;
    }
    if ((arg === '--size' || arg === '-s') && args[i + 1]) {
      const candidate = args[i + 1] as PerfSize;
      if ((PERF_SIZES as readonly string[]).includes(candidate)) {
        size = candidate;
      }
      i += 1;
      continue;
    }
  }

  return { uri, size };
}

async function main() {
  const { uri, size } = parseArgs(process.argv.slice(2));
  const email = process.env.PERF_USER_EMAIL;
  const password = process.env.PERF_USER_PASSWORD;

  // Required, never defaulted: a committed credential in a script is a
  // credential leak waiting for a database that is not a throwaway (`NFR-006`).
  if (!email || !password) {
    console.error(
      'PERF_USER_EMAIL and PERF_USER_PASSWORD are required. ' +
        'Set them in the shell, or in a local .env that is never committed.',
    );
    process.exit(1);
  }

  const result = await seed(uri, size, email, password);

  console.log(JSON.stringify({ status: 'ok', ...result }, null, 2));
}

export async function seed(
  uri: string,
  size: PerfSize,
  email: string,
  password: string,
): Promise<SeedResult> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      MongooseModule.forRoot(uri, { monitorCommands: false }),
      StatsChartsModule,
      MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    ],
  }).compile();

  await moduleRef.init();
  const connection = moduleRef.get<Connection>(getConnectionToken());
  const UserModel = moduleRef.get<Model<User>>(getModelToken(User.name));

  try {
    const dataset = buildPerfDataset(size);
    const userIdStr = dataset.userId;

    await connection.collection('users').deleteMany({ email });
    const hashed = await bcrypt.hash(password, 10);
    await UserModel.create({
      // Pinned to the dataset's user id, not left to Mongo.
      //
      // `login` puts `user._id` in the JWT (`sub`), the guard resolves it to this
      // document, and `extractUserId()` hands its `_id` to every calculator. A
      // random `_id` would therefore authenticate a user that owns none of the
      // seeded documents, and every chart would answer `[]` with HTTP 200 and no
      // GraphQL error — a green k6 run that measured an empty database.
      _id: new Types.ObjectId(dataset.userId),
      name: 'Perf StatsCharts',
      email,
      password: hashed,
      role: 'user' as any,
      timezone: dataset.timezone,
    });

    const models = {
      workoutSession: moduleRef.get<Model<any>>(
        getModelToken(COLLECTION_MODELS.workoutSession),
      ),
      weekLog: moduleRef.get<Model<any>>(
        getModelToken(COLLECTION_MODELS.weekLog),
      ),
      dayLog: moduleRef.get<Model<any>>(
        getModelToken(COLLECTION_MODELS.dayLog),
      ),
      extraSession: moduleRef.get<Model<any>>(
        getModelToken(COLLECTION_MODELS.extraSession),
      ),
      exercise: moduleRef.get<Model<any>>(
        getModelToken(COLLECTION_MODELS.exercise),
      ),
      userWeightLog: moduleRef.get<Model<any>>(
        getModelToken(COLLECTION_MODELS.userWeightLog),
      ),
      routinePlan: moduleRef.get<Model<any>>(
        getModelToken(COLLECTION_MODELS.routinePlan),
      ),
      routineDay: moduleRef.get<Model<any>>(
        getModelToken(COLLECTION_MODELS.routineDay),
      ),
      userProfile: moduleRef.get<Model<any>>(
        getModelToken(COLLECTION_MODELS.userProfile),
      ),
    };

    await Promise.all(Object.values(models).map((m) => (m as any).init?.()));

    const db = connection.db;
    if (!db) throw new Error('Mongoose connection has no database handle.');
    const perfUser = new Types.ObjectId(userIdStr);

    // Delete only this perf user's documents — never the database.
    //
    // The cast is load-bearing: `userId` resolves to `SchemaMixed` in these
    // schemas, so Mongoose applies no implicit casting and a raw string filter
    // matches zero documents. The dataset is deterministic, so a run whose
    // deletes silently no-op collides with its own `_id`s on the second pass.
    await models.workoutSession.deleteMany({ userId: perfUser });
    await models.extraSession.deleteMany({ userId: perfUser });
    await models.userWeightLog.deleteMany({ userId: perfUser });
    await models.userProfile.deleteMany({ userId: perfUser });
    await models.weekLog.deleteMany({ userId: perfUser });
    await models.dayLog.deleteMany({ userId: perfUser });

    // The routine plan and its days are shared, perf-owned documents keyed by a
    // stable id rather than by `userId`, so they are cleared by explicit id to
    // keep a second run from colliding on `_id`. Exercises are upserted upstream
    // and need no clearing.
    await models.routineDay.deleteMany({
      _id: { $in: dataset.routineDays.map((day) => day._id) },
    });
    await models.routinePlan.deleteMany({ _id: dataset.routinePlan._id });

    const counts = await seedPerfDatasets(moduleRef, [dataset]);

    // Read back what is actually stored, so the caller can assert idempotency
    // against the database rather than against what the seed claimed to write.
    const readBack = {
      workoutSessions: await models.workoutSession.countDocuments({
        userId: perfUser,
      }),
      extraSessions: await models.extraSession.countDocuments({
        userId: perfUser,
      }),
      userWeightLogs: await models.userWeightLog.countDocuments({
        userId: perfUser,
      }),
      userProfiles: await models.userProfile.countDocuments({
        userId: perfUser,
      }),
      weekLogs: await models.weekLog.countDocuments({ userId: perfUser }),
      dayLogs: await models.dayLog.countDocuments({ userId: perfUser }),
      exercises: await models.exercise.countDocuments({}),
      routineDays: await models.routineDay.countDocuments({}),
      routinePlans: await models.routinePlan.countDocuments({}),
    };

    return {
      size,
      uri,
      email,
      userId: userIdStr,
      counts,
      readBack,
      // A hash of the stored session ids, so two runs can be compared for
      // identical content rather than merely identical counts.
      fingerprint: await fingerprint(
        db,
        'workoutsessions',
        perfUser,
        (doc: any) => doc._id.toString(),
      ),
    };
  } finally {
    await moduleRef.close();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
