# Stats Module - Metrics and Statistics

> Part of the stable module documentation. Specs live under `sdd/`; this document describes the implemented system state.
> **Status:** Current
> **Last updated:** 2026-09-13

> **Warning: experimental module.** It has ~32 files with hexagonal architecture, but it is **not active in production** and by decision it is kept **out of the test suite** (0% coverage).

## Purpose

The `stats` module computes and exposes training metrics for each user, using an **external worker/Lambda** that handles the heavy computation. NestJS **never computes the statistics**: it only publishes the event, offers the raw data to the worker and stores (upsert) the already-computed results.

Metrics it manages:

| Metric | What it measures |
|---|---|
| **Top Exercises** | Most used exercises by the user (top 5 by sessions/volume) |
| **Top Routines** | Most used routine plans (top 5 by weeks/sessions) |
| **Personal Records** | Best marks per exercise (estimated 1RM, best weight/volume) |
| **Adherence** | Weekly adherence (% of completed vs. planned days) |

## Architecture

Follows the hexagonal pattern (Clean Architecture) of the rest of the project:

```
Resolver -> Service -> Use Case -> Domain (interface) <- Infrastructure (implementation)
```

| Layer | Directory | Responsibility |
|---|---|---|
| **Presentation** | `presentation/` | GraphQL output entities (`*.output.ts`) and input DTOs (`save-stats.input.ts`, `worker-raw-data.output.ts`) |
| **Application** | `application/use-cases/` | 9 use cases: 4 `get-*`, 4 `save-*`, 1 `get-raw-data-for-worker` |
| **Domain** | `domain/` | Domain entities (`stats.domain.ts`) and `IStatsRepository` interface |
| **Infrastructure** | `infrastructure/` | Mongoose schemas (9) and `StatsRepository` (concrete implementation) |

### File structure

```
stats/
├── stats.module.ts                     # NestJS module (schema registration + providers)
├── stats.resolver.ts                   # GraphQL Queries/Mutations and guards
├── stats.service.ts                    # Facade that delegates to the use cases
├── stats-event-publisher.ts            # Publishes events to SQS
├── application/use-cases/              # Business logic (9 use cases)
├── domain/entities/                    # Domain entities + raw data interfaces
├── domain/interfaces/repositories/     # IStatsRepository interface + token
├── infrastructure/repositories/        # StatsRepository (Mongoose)
├── infrastructure/schemas/             # Mongoose schemas
└── presentation/dto/ + entities/       # GraphQL layer
```

Note: the former `src/modules/stats/CONTRACT.md` (API <-> worker contract) and `src/modules/stats/LAMBDA.md` (Lambda implementation guide) were removed in the documentation migration; their content is fully folded into the "Worker contract" and "Lambda implementation guide" sections of this document.

## Internal architecture

### `stats.module.ts`

- Imports `MongooseModule.forFeature` with the **9 schemas**:
  - 4 output (results): `UserTopExercise`, `UserTopRoutine`, `UserPersonalRecord`, `UserAdherence`
  - 5 reference (raw-data reads): `WorkoutSession`, `WeekLog`, `Exercise`, `RoutinePlan`, `UserStrengthMetric`
- Registers `StatsResolver`, `StatsService`, `StatsEventPublisher`, the 9 use cases (`STAT_USE_CASES`) and the `StatsRepository` under the token `STATS_REPOSITORY`.
- Exports `StatsService`.

### `stats.resolver.ts` - GraphQL operations

**Queries (GqlAuthGuard - user cookie JWT):**

| Operation | Description |
|---|---|
| `getTopExercises` -> `TopExerciseStats` | Top 5 exercises of the user |
| `getTopRoutines` -> `TopRoutineStats` | Top 5 routines of the user |
| `getPersonalRecords` -> `PersonalRecordStats` | Best marks of the user |
| `getAdherence` -> `AdherenceStats` | Weekly adherence of the user |

**Query / Mutations (ServiceAuthGuard - service JWT `role: SERVICE`, scope `stats:read/write`):**

| Operation | Description |
|---|---|
| `getRawDataForWorker(userId)` -> `WorkerRawData` | Raw data for the worker to process |
| `saveTopExercises(userId, input)` | Worker saves computed top exercises |
| `saveTopRoutines(userId, input)` | Worker saves computed top routines |
| `savePersonalRecords(userId, input)` | Worker saves computed records |
| `saveAdherence(userId, input)` | Worker saves computed adherence |

All user get operations obtain `userId` from the context (`extractUserId`), while service operations receive `userId` as an explicit argument (the worker extracts it from the SQS message).

### Domain layer

- **Entities**: `TopExerciseEntryDomain`, `TopRoutineEntryDomain`, `PersonalRecordEntryDomain`, `AdherenceWeekDomain` and the containers `UserTopExerciseDomain`, `UserTopRoutineDomain`, `UserPersonalRecordDomain`, `UserAdherenceDomain`.
- **Interface** `IStatsRepository` (token `STATS_REPOSITORY`):
  - Reads: `findTopExercisesByUser`, `findTopRoutinesByUser`, `findPersonalRecordsByUser`, `findAdherenceByUser`
  - Writes: `upsertTopExercises`, `upsertTopRoutines`, `upsertPersonalRecords`, `upsertAdherence`
- **Raw data types** (`RawWorkoutSessionData`, `RawWeekLogData`, `RawExerciseData`, `RawRoutinePlanData`, `RawStrengthMetricData`) grouped in `WorkerRawDataDomain`.

### Use cases

- **`save-*` (4):** receive the computed data + `computedAt`, build the domain object and delegate to the repository to perform the **upsert** (1 doc per user and collection).
- **`get-*` (4):** query the stored result for the user (or `null` if it does not exist yet).
- **`getRawDataForWorker` (1):** queries in parallel the 5 reference collections and returns the raw data:
  - `WorkoutSession` with `status: 'complete'` and no soft-delete, ordered by date.
  - `WeekLog` without soft-delete (includes its 7 days, with `status`, `isRest`, `planId`).
  - Full `Exercise` catalog.
  - `RoutinePlan` created by the user (`createdBy: userId`).
  - User `UserStrengthMetric`, ordered by `measuredAt`.

### `StatsRepository` (infrastructure)

- Reads each model with `findOne({ userId })` and maps the Mongoose document to a domain entity.
- Writes via `findOneAndUpdate({ userId }, {...}, { upsert: true, new: true, runValidators: true })`: **one document per user and metric** (unique index on `userId`).
- Converts ObjectIds (`exerciseId`, `planId`) from/to strings.

### Mongoose schemas

**Result schemas** (1 document per user, unique `userId`):

| Schema | Content per entry |
|---|---|
| `UserTopExercise` | `rank`, `exerciseId`, `name`, `category`, `totalSessions`, `totalVolume`, `avgVolumePerSession` |
| `UserTopRoutine` | `rank`, `planId`, `name`, `totalWeeks`, `totalSessions`, `adherenceRate` |
| `UserPersonalRecord` | `exerciseId`, `exerciseName`, `category`, `oneRmEstimated`, `bestWeight`, `bestReps`, `bestVolume`, `achievedAt`, `previousOneRm` |
| `UserAdherence` | `weekStartDate`, `totalDays`, `completedDays`, `skippedDays`, `pendingDays`, `adherencePercent` |

All have `userId` (unique), `computedAt` and `timestamps`.

**Reference schemas** (defined locally with the name "reference" to read already-existing collections): `WorkoutSession`, `WeekLog`, `Exercise`, `RoutinePlan`, `UserStrengthMetric`. Used only in `getRawDataForWorker` and in the trigger mechanism.

## Events and trigger (SQS)

`StatsEventPublisher` listens to Nest `EventEmitter` events:

| Event | Emitter | When |
|---|---|---|
| `workout-session.saved` | WorkoutSession | When saving a training session |
| `week-log.finalized` | WeekLog | When finalizing/sealing a week |

If `STATS_SQS_QUEUE_URL` is configured, it publishes the message to SQS:

```json
{
  "userId": "507f1f77bcf86cd799439011",
  "triggerType": "WORKOUT_SESSION | WEEK_LOG_FINALIZED",
  "entityId": "507f1f77bcf86cd799439012",
  "timestamp": "2026-08-19T14:30:00.000Z"
}
```

> If the SQS URL is **not** configured, the publisher starts but **silently skips** the send (events keep firing internally). This allows the module to never block the main tracking flow.

The message is sent to a **FIFO queue**: `MessageGroupId: 'workout-session-group'` with a unique `MessageDeduplicationId` (timestamp + random), and a `triggerType` message attribute (String, same value as the body field).

## Worker contract

The contract between the NestJS API and the Stats worker/Lambda is defined here.

**Rule: the Lambda never writes to MongoDB directly.** The Lambda computes and calls these mutations; Nest does the upsert.

### Channel 1: SQS trigger message

When a WorkoutSession is saved or a WeekLog is finalized, NestJS publishes a message to the `STATS_SQS_QUEUE_URL` queue:

```json
{
  "userId": "507f1f77bcf86cd799439011",
  "triggerType": "WORKOUT_SESSION | WEEK_LOG_FINALIZED",
  "entityId": "507f1f77bcf86cd799439012",
  "timestamp": "2026-08-19T14:30:00.000Z"
}
```

Fields: `userId` (String ObjectId, the user who triggered the event), `triggerType` (enum `WORKOUT_SESSION` | `WEEK_LOG_FINALIZED`), `entityId` (String ObjectId, ID of the WorkoutSession or WeekLog), `timestamp` (ISO 8601, when the event was emitted). MessageAttribute: `triggerType` (String, same as body field). The Lambda extracts `userId` from the message body; that is the only input it needs.

### Channel 2: Worker -> Lambda (getRawDataForWorker)

Auth: `Authorization: Bearer <service-jwt>`. The service JWT is generated with `npm run generate:service-token`. It must have `role: "SERVICE"` and scope `stats:read`.

```graphql
query GetRawDataForWorker($userId: ID!) {
  getRawDataForWorker(userId: $userId) {
    workoutSessions {
      id
      userId
      date
      routineDayId
      status
      exercises {
        exerciseId
        series
        sets {
          reps
          weights
        }
      }
    }
    weekLogs {
      id
      userId
      startDate
      endDate
      planId
      completed
      days {
        order
        date
        isRest
        status
      }
    }
    exercises {
      id
      name
      category
      usesWeight
    }
    routinePlans {
      id
      name
      description
    }
    strengthMetrics {
      id
      exerciseKey
      oneRmKg
      measuredAt
    }
  }
}
```

WorkerRawData shape: `workoutSessions` (`RawWorkoutSession`: `id`, `userId`, `date`, `routineDayId`, `status`, `exercises` of `RawExercisePerformance` = `{ exerciseId, series, sets: [{ reps, weights }] }`), `weekLogs` (`RawWeekLog`: `id`, `userId`, `startDate`, `endDate`, `planId`, `completed`, `days` of `RawWeekLogDay` = `{ order, date, isRest, status }`), `exercises` (`RawExercise`: `id`, `name`, `category`, `usesWeight`), `routinePlans` (`RawRoutinePlan`: `id`, `name`, `description`), `strengthMetrics` (`RawStrengthMetric`: `id`, `exerciseKey`, `oneRmKg`, `measuredAt`).

### Channel 3: Lambda -> NestJS (saveXxx mutations)

All 4 mutations require a service JWT and accept `userId` as a separate argument. Each receives a `computedAt` timestamp plus an entries array:

- `saveTopExercises(userId, input { computedAt, exercises: [{ rank, exerciseId, name, category, totalSessions, totalVolume, avgVolumePerSession }] })`
- `saveTopRoutines(userId, input { computedAt, routines: [{ rank, planId, name, totalWeeks, totalSessions, adherenceRate }] })`
- `savePersonalRecords(userId, input { computedAt, records: [{ exerciseId, exerciseName, category, oneRmEstimated, bestWeight, bestReps, bestVolume, achievedAt, previousOneRm }] })`
- `saveAdherence(userId, input { computedAt, weeks: [{ weekStartDate, totalDays, completedDays, skippedDays, pendingDays, adherencePercent }] })`

Each returns its result type (`TopExerciseStats`, `TopRoutineStats`, `PersonalRecordStats`, `AdherenceStats`) with `id`, `userId`, `computedAt` and the entries.

## Lambda implementation guide

The Lambda is triggered by an SQS message. It:
1. Authenticates to the NestJS API with a service JWT (stored in AWS Secrets Manager as `STATS_SERVICE_JWT`; if the API returns 401, the token is expired - alert/stop, do not generate tokens).
2. Fetches raw training data via GraphQL.
3. Computes 4 stats.
4. Saves results back to the API via GraphQL mutations.

**Environment for the Lambda:** `GRAPHQL_API_URL` (required, full URL, e.g. `https://wave-fit-api.onrender.com/graphql`), `STATS_SERVICE_JWT` (required, Bearer token for API auth), `AWS_REGION` (required for SQS trigger).

**Computation outline:**

- **Top 5 Exercises (by usage):** count how many workoutSessions include each `exerciseId`; volume = sum of `set.reps * set.weights`. Rank by count, take top 5. Entries: `rank`, `exerciseId`, `name`/`category` from the catalog, `totalSessions`, `totalVolume`, `avgVolumePerSession`.
- **Top 5 Routines (by usage):** count how many weekLogs reference each `planId`; `totalDays` += 7 per week; `completedDays` += days with `status == "complete"`. Rank by count, take top 5. Entries: `rank`, `planId`, `name` from routinePlans, `totalWeeks`, `totalSessions` (sum of completed days), `adherenceRate` = (completedDays / totalDays) x 100.
- **Personal Records:** for each exercise with `usesWeight: true`, find the best performance. Important seeded exercises: `squat`, `bench_press`, `incline_bench`, `overhead_press`, `barbell_row`, `romanian_deadlift`, `hip_thrust`. The `exerciseKey` in `strengthMetrics` matches the Spanish exercise name (normalized). 1RM via the **Brzycki formula**: `one_rm = weight * (36 / (37 - reps))` for `1 <= reps <= 36`. Entries: `bestWeight`, `bestReps`, `bestVolume` (max `weight * reps * series` in a single session), `oneRmEstimated` (max Brzycki 1RM), `achievedAt` (date of the session with best volume), `previousOneRm` (most recent `oneRmKg` from `strengthMetrics` by `measuredAt`, or `null`). Only include exercises appearing in at least 1 completed session.
- **Adherence:** for each weekLog: `totalDays = 7`, counts of days by `status` (`pending`, `complete`, `skipped`), `adherencePercent = (completedDays / totalDays) * 100`. Only include weekLogs where at least 1 day has been acted upon (not all pending).

**Error handling:** if `getRawDataForWorker` returns empty `workoutSessions` and `weekLogs`, still call all 4 save mutations with empty arrays (this clears stale stats). If a save mutation fails, log and retry once; if it fails again, send a dead-letter to SQS (don't block the queue). Never store raw data from the API - only computed stats. The Lambda returns nothing meaningful to SQS (fire-and-forget); all side effects are the 4 save mutations.

**Reference values:** valid exercise `category` values: `chest, back, legs, legs_front, legs_posterior, biceps, triceps, shoulders, core, cardio, rest`. WeekLog day `status` values: `pending` (not yet acted upon), `complete` (workout done), `skipped` (intentionally skipped).

## Complete data flow

```
1. User saves WorkoutSession / finalizes WeekLog
2. Resolver emits the event (workout-session.saved / week-log.finalized)
3. StatsEventPublisher -> publishes to SQS
4. Worker picks up the SQS message
5. Worker calls getRawDataForWorker(userId) -> gets raw data
6. Lambda (Python) computes the 4 metrics
7. Worker calls saveTopExercises / saveTopRoutines / savePersonalRecords / saveAdherence
8. NestJS upserts (1 document per user per collection)
9. Frontend queries with getTopExercises / getTopRoutines / getPersonalRecords / getAdherence
```

## Authentication

| Guard | Token type | Use |
|---|---|---|
| `GqlAuthGuard` | User JWT (HttpOnly `token` cookie) | Read queries for the frontend |
| `ServiceAuthGuard` | Service JWT (`role: SERVICE`, scopes `stats:read` / `stats:write`) | `getRawDataForWorker`, `saveTopExercises`, `saveTopRoutines`, `savePersonalRecords`, `saveAdherence` |

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | Yes | Shared secret to sign user and service JWTs |
| `STATS_SQS_QUEUE_URL` | No | SQS queue URL. If not set, publishing is disabled (events still fire internally) |
| `AWS_REGION` | No | AWS region for the SQS client. Default: `us-east-1` |
| `AWS_ACCESS_KEY` | Outside AWS | IAM credentials for SQS (`accessKeyId`; not needed with an IAM role on EC2/ECS). Names follow the code in `stats-event-publisher.ts`, not the AWS SDK defaults. |
| `AWS_SECRET_KEY` | Outside AWS | IAM credentials for SQS (`secretAccessKey`) |

## Status / Roadmap

- **Registered** in `app.module.ts`.
- **Implemented**: full resolver, 9 use cases, repository, 9 schemas, SQS publisher.
- **Not active** in production.
- **Out of the test suite** (0% coverage - experimental, low priority).
- The worker contract (API <-> worker, "Lambda never writes to MongoDB directly") and the Lambda implementation guidance formerly in `CONTRACT.md` / `LAMBDA.md` are folded into this document (see the Worker Contract and Lambda Implementation Guide sections); those files were removed.

> If the module is activated in the future, start with the pure use cases (`save-*`, `get-raw-data-for-worker`); see the draft spec `sdd/stats-tests.md`.