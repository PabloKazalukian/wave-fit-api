# Stats Module — Contract

This document defines the contract between the NestJS API and the Stats worker/Lambda.

> **Lambda nunca escribe en MongoDB directamente.** Lambda calcula y llama estas mutations; Nest hace el upsert.

---

## Canal 1: SQS Trigger Message

When a WorkoutSession is saved or a WeekLog is finalized, NestJS publishes this message to the `STATS_SQS_QUEUE_URL` queue:

```json
{
  "userId": "507f1f77bcf86cd799439011",
  "triggerType": "WORKOUT_SESSION",
  "entityId": "507f1f77bcf86cd799439012",
  "timestamp": "2026-08-19T14:30:00.000Z"
}
```

### Fields

| Field | Type | Values |
|-------|------|--------|
| `userId` | String (ObjectId) | The user who triggered the event |
| `triggerType` | String enum | `WORKOUT_SESSION` \| `WEEK_LOG_FINALIZED` |
| `entityId` | String (ObjectId) | ID of the WorkoutSession or WeekLog |
| `timestamp` | ISO 8601 | When the event was emitted |

### MessageAttributes

| Key | Type | Value |
|-----|------|-------|
| `triggerType` | String | Same as body field |

---

## Canal 2: Worker → Lambda (getRawDataForWorker)

### Auth

```
Authorization: Bearer <service-jwt>
```

Service JWT is generated with `npm run generate:service-token`. Must have `role: "SERVICE"` and scope `stats:read`.

### Query

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

### Response Types

```graphql
type WorkerRawData {
  workoutSessions: [RawWorkoutSession!]!
  weekLogs: [RawWeekLog!]!
  exercises: [RawExercise!]!
  routinePlans: [RawRoutinePlan!]!
  strengthMetrics: [RawStrengthMetric!]!
}

type RawWorkoutSession {
  id: ID!
  userId: ID!
  date: DateTime!
  routineDayId: ID
  status: String!
  exercises: [RawExercisePerformance!]!
}

type RawExercisePerformance {
  exerciseId: ID!
  series: Float!
  sets: [RawSetData!]!
}

type RawSetData {
  reps: Float!
  weights: Float
}

type RawWeekLog {
  id: ID!
  userId: ID!
  startDate: DateTime!
  endDate: DateTime!
  planId: ID
  completed: Boolean!
  days: [RawWeekLogDay!]!
}

type RawWeekLogDay {
  order: Float!
  date: DateTime!
  isRest: Boolean!
  status: String!
}

type RawExercise {
  id: ID!
  name: String!
  category: String!
  usesWeight: Boolean!
}

type RawRoutinePlan {
  id: ID!
  name: String!
  description: String!
}

type RawStrengthMetric {
  id: ID!
  exerciseKey: String!
  oneRmKg: Float!
  measuredAt: DateTime!
}
```

---

## Canal 3: Lambda → NestJS (saveXxx mutations)

All 4 mutations require a service JWT and accept `userId` as a separate argument.

### Auth

```
Authorization: Bearer <service-jwt>
```

### saveTopExercises

```graphql
mutation SaveTopExercises($userId: ID!, $input: SaveTopExercisesInput!) {
  saveTopExercises(userId: $userId, input: $input) {
    id
    userId
    computedAt
    exercises {
      rank
      exerciseId
      name
      category
      totalSessions
      totalVolume
      avgVolumePerSession
    }
  }
}

input SaveTopExercisesInput {
  computedAt: String!
  exercises: [SaveTopExerciseEntryInput!]!
}

input SaveTopExerciseEntryInput {
  rank: Int!
  exerciseId: ID!
  name: String!
  category: String!
  totalSessions: Int!
  totalVolume: Float!
  avgVolumePerSession: Float!
}
```

### saveTopRoutines

```graphql
mutation SaveTopRoutines($userId: ID!, $input: SaveTopRoutinesInput!) {
  saveTopRoutines(userId: $userId, input: $input) {
    id
    userId
    computedAt
    routines {
      rank
      planId
      name
      totalWeeks
      totalSessions
      adherenceRate
    }
  }
}

input SaveTopRoutinesInput {
  computedAt: String!
  routines: [SaveTopRoutineEntryInput!]!
}

input SaveTopRoutineEntryInput {
  rank: Int!
  planId: ID!
  name: String!
  totalWeeks: Int!
  totalSessions: Int!
  adherenceRate: Float!
}
```

### savePersonalRecords

```graphql
mutation SavePersonalRecords($userId: ID!, $input: SavePersonalRecordsInput!) {
  savePersonalRecords(userId: $userId, input: $input) {
    id
    userId
    computedAt
    records {
      exerciseId
      exerciseName
      category
      oneRmEstimated
      bestWeight
      bestReps
      bestVolume
      achievedAt
      previousOneRm
    }
  }
}

input SavePersonalRecordsInput {
  computedAt: String!
  records: [SavePersonalRecordEntryInput!]!
}

input SavePersonalRecordEntryInput {
  exerciseId: ID!
  exerciseName: String!
  category: String!
  oneRmEstimated: Float!
  bestWeight: Float!
  bestReps: Float!
  bestVolume: Float!
  achievedAt: String!
  previousOneRm: Float
}
```

### saveAdherence

```graphql
mutation SaveAdherence($userId: ID!, $input: SaveAdherenceInput!) {
  saveAdherence(userId: $userId, input: $input) {
    id
    userId
    computedAt
    weeks {
      weekStartDate
      totalDays
      completedDays
      skippedDays
      pendingDays
      adherencePercent
    }
  }
}

input SaveAdherenceInput {
  computedAt: String!
  weeks: [SaveAdherenceWeekEntryInput!]!
}

input SaveAdherenceWeekEntryInput {
  weekStartDate: String!
  totalDays: Int!
  completedDays: Int!
  skippedDays: Int!
  pendingDays: Int!
  adherencePercent: Float!
}
```

---

## Response Types (shared)

```graphql
type TopExerciseStats {
  id: ID!
  userId: ID!
  computedAt: DateTime!
  exercises: [TopExerciseEntry!]!
}

type TopExerciseEntry {
  rank: Int!
  exerciseId: ID!
  name: String!
  category: String!
  totalSessions: Int!
  totalVolume: Float!
  avgVolumePerSession: Float!
}

type TopRoutineStats {
  id: ID!
  userId: ID!
  computedAt: DateTime!
  routines: [TopRoutineEntry!]!
}

type TopRoutineEntry {
  rank: Int!
  planId: ID!
  name: String!
  totalWeeks: Int!
  totalSessions: Int!
  adherenceRate: Float!
}

type PersonalRecordStats {
  id: ID!
  userId: ID!
  computedAt: DateTime!
  records: [PersonalRecordEntry!]!
}

type PersonalRecordEntry {
  exerciseId: ID!
  exerciseName: String!
  category: String!
  oneRmEstimated: Float!
  bestWeight: Float!
  bestReps: Float!
  bestVolume: Float!
  achievedAt: DateTime!
  previousOneRm: Float
}

type AdherenceStats {
  id: ID!
  userId: ID!
  computedAt: DateTime!
  weeks: [AdherenceWeekEntry!]!
}

type AdherenceWeekEntry {
  weekStartDate: DateTime!
  totalDays: Int!
  completedDays: Int!
  skippedDays: Int!
  pendingDays: Int!
  adherencePercent: Float!
}
```

---

## User-Facing Queries

These queries are for the frontend (GqlAuthGuard, cookie-based JWT):

```graphql
query GetTopExercises {
  getTopExercises {
    id
    computedAt
    exercises { rank, name, category, totalSessions, totalVolume }
  }
}

query GetTopRoutines {
  getTopRoutines {
    id
    computedAt
    routines { rank, name, totalWeeks, totalSessions, adherenceRate }
  }
}

query GetPersonalRecords {
  getPersonalRecords {
    id
    computedAt
    records { exerciseId, exerciseName, oneRmEstimated, bestWeight, achievedAt, previousOneRm }
  }
}

query GetAdherence {
  getAdherence {
    id
    computedAt
    weeks { weekStartDate, completedDays, totalDays, adherencePercent }
  }
}
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | Same secret used for user JWTs. Service tokens use this too. |
| `STATS_SQS_QUEUE_URL` | No | SQS queue URL. If not set, SQS publishing is disabled (events still fire internally). |
| `AWS_REGION` | No | AWS region for SQS client. Default: `us-east-1`. |
| `AWS_ACCESS_KEY_ID` | If not on AWS | IAM credentials for SQS. Not needed if running on EC2/ECS with IAM role. |
| `AWS_SECRET_ACCESS_KEY` | If not on AWS | IAM credentials for SQS. |

---

## Flow Summary

```
1. User saves WorkoutSession / finalizes WeekLog
2. Resolver emits event (workout-session.saved / week-log.finalized)
3. StatsEventPublisher → publishes to SQS
4. Worker picks up SQS message
5. Worker calls getRawDataForWorker(userId) → gets raw data
6. Worker sends data to Lambda (Python)
7. Lambda computes stats → returns results to Worker
8. Worker calls saveTopExercises / saveTopRoutines / savePersonalRecords / saveAdherence
9. NestJS upserts 1 document per user per collection
10. Frontend reads via getTopExercises / getTopRoutines / getPersonalRecords / getAdherence
```
