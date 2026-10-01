import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, ObjectId } from 'mongodb';

/**
 * `TEST-006` — the standalone seed is idempotent and scoped to the perf user.
 *
 * Proves `FR-008` and `NFR-007`: running the script twice against a throwaway
 * database leaves the same document counts *and* the same content, and no
 * document belonging to anyone else is touched.
 *
 * The script is spawned as a real subprocess rather than imported, so this also
 * covers its argument parsing and its process lifecycle — the exact path
 * `npm run perf:seed` takes.
 */

const SCRIPT = join(
  __dirname,
  '..',
  '..',
  'scripts',
  'perf',
  'seed-stats-charts.ts',
);
const EMAIL = 'perf-idempotency@wavefit.test';
const PASSWORD = 'perf-password';

/**
 * `execFileSync` deadlocks on Windows: the synchronous spawn never reaps the
 * child once this process has already spawned one of its own (`mongod`, from
 * `MongoMemoryServer`), so the call blocks forever and Jest's own timeouts
 * cannot interrupt it. The async spawn runs the same subprocess, through the
 * same argument parsing and the same process lifecycle, and completes in
 * seconds.
 */
const execFileAsync = promisify(execFile);

interface SeedOutput {
  status: string;
  size: string;
  userId: string;
  counts: Record<string, number>;
  readBack: Record<string, number>;
  fingerprint: string;
}

async function runSeed(uri: string, size: string): Promise<SeedOutput> {
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      join(__dirname, '..', '..', 'node_modules', 'ts-node', 'dist', 'bin.js'),
      '-r',
      'tsconfig-paths/register',
      SCRIPT,
      '--uri',
      uri,
      '--size',
      size,
    ],
    {
      encoding: 'utf8',
      cwd: join(__dirname, '..', '..'),
      timeout: 120_000,
      env: {
        ...process.env,
        PERF_USER_EMAIL: EMAIL,
        PERF_USER_PASSWORD: PASSWORD,
      },
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  return JSON.parse(stdout) as SeedOutput;
}

describe('seed-stats-charts (idempotency, TEST-006)', () => {
  let mongo: MongoMemoryServer;
  let uri: string;
  let client: MongoClient;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    uri = mongo.getUri();
    client = new MongoClient(uri);
    await client.connect();
  }, 180_000);

  afterAll(async () => {
    if (client) await client.close();
    if (mongo) await mongo.stop();
  }, 60_000);

  it('leaves identical counts and content across two runs', async () => {
    const first = await runSeed(uri, 'small');
    const second = await runSeed(uri, 'small');

    expect(first.status).toBe('ok');
    expect(second.status).toBe('ok');

    // Same documents, not merely the same count.
    expect(second.readBack).toEqual(first.readBack);
    expect(second.fingerprint).toBe(first.fingerprint);
    expect(second.counts).toEqual(first.counts);

    // The counts match what the script reported writing.
    expect(second.readBack.workoutSessions).toBe(second.counts.workoutSessions);
    expect(second.readBack.extraSessions).toBe(second.counts.extraSessions);
    expect(second.readBack.userWeightLogs).toBe(second.counts.userWeightLogs);
  }, 300_000);

  it('never deletes documents owned by another user', async () => {
    const db = client.db();
    const foreignId = new ObjectId();
    await db
      .collection('workoutsessions')
      .insertOne({
        _id: foreignId,
        userId: foreignId,
        date: new Date(),
        status: 'complete',
      });

    expect(
      await db
        .collection('workoutsessions')
        .countDocuments({ userId: foreignId }),
    ).toBe(1);

    const { readBack, userId } = await runSeed(uri, 'small');

    // Still there: the seed is scoped to the perf user, not a global wipe.
    expect(
      await db
        .collection('workoutsessions')
        .countDocuments({ userId: foreignId }),
    ).toBe(1);

    // And the perf user still has data, proving the delete was targeted.
    expect(readBack.workoutSessions).toBeGreaterThan(0);
    expect(
      await db
        .collection('workoutsessions')
        .countDocuments({ userId: new ObjectId(userId) }),
    ).toBe(readBack.workoutSessions);

    await db.collection('workoutsessions').deleteMany({ userId: foreignId });
  }, 300_000);

  it('creates a loginable user with a bcrypt password (FR-008)', async () => {
    const db = client.db();
    const user = await db.collection('users').findOne({ email: EMAIL });
    expect(user).not.toBeNull();
    // Never a plaintext password: bcrypt hashes start with `$2`.
    expect(user!.password).toMatch(/^\$2[aby]\$/);
    expect(user!.password).not.toBe(PASSWORD);
  }, 60_000);
});
