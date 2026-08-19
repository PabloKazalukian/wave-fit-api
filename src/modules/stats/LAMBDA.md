# Stats Lambda — Implementation Guide

This document contains everything needed to implement the Stats Lambda in Python.

---

## Overview

The Lambda is triggered by an SQS message. It:
1. Authenticates to the NestJS API with a service JWT
2. Fetches raw training data via GraphQL
3. Computes 4 stats: Top Exercises, Top Routines, Personal Records, Adherence
4. Saves results back to the API via GraphQL mutations

---

## 1. SQS Trigger

The Lambda receives this message from the queue:

```json
{
  "userId": "507f1f77bcf86cd799439011",
  "triggerType": "WORKOUT_SESSION | WEEK_LOG_FINALIZED",
  "entityId": "507f1f77bcf86cd799439012",
  "timestamp": "2026-08-19T14:30:00.000Z"
}
```

**What to do with this:** Extract `userId` from the message body. That's the only input you need.

---

## 2. Authentication

Every GraphQL request must include:

```
Authorization: Bearer <service-jwt>
```

The JWT is generated outside this Lambda (stored in AWS Secrets Manager as `STATS_SERVICE_JWT`).

If the API returns 401, the token is expired — alert/stop. Do NOT generate tokens.

---

## 3. Fetch Raw Data

**Endpoint:** The GraphQL API URL (from env var `GRAPHQL_API_URL`)

**Query:**

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

**Variables:**
```json
{ "userId": "<userId from SQS message>" }
```

---

## 4. What You Get Back

### workoutSessions[]
Completed training sessions. Each has:
- `exercises[]` — which exercises were done
  - `exerciseId` — reference to the exercise catalog
  - `sets[]` — each set with `reps` and `weights` (in kg)

### weekLogs[]
Weekly logs. Each has:
- `days[7]` — each day with `status`: `"pending"` | `"complete"` | `"skipped"`
- `planId` — which RoutinePlan was used

### exercises[]
Exercise catalog (all exercises in the system). Used to resolve names and categories.

### routinePlans[]
Routine plans created by the user. Used to resolve routine names.

### strengthMetrics[]
User's known 1RM values per exercise. Used to compute `previousOneRm` for PR tracking.

---

## 5. Compute Stats

### 5.1 Top 5 Exercises (by usage)

Count how many `workoutSessions` include each `exerciseId` in their `exercises[]` array.

```
For each session in workoutSessions:
  For each exercise in session.exercises:
    count[exercise.exerciseId] += 1
    volume[exercise.exerciseId] += sum(set.reps * set.weights for each set)
```

Rank by `count` (descending). Take top 5.

For each entry compute:
- `rank`: 1-5
- `exerciseId`: the exercise ID
- `name`: from exercises catalog
- `category`: from exercises catalog
- `totalSessions`: the count
- `totalVolume`: sum of (reps × weights) across all sessions
- `avgVolumePerSession`: totalVolume / totalSessions

### 5.2 Top 5 Routines (by usage)

Count how many `weekLogs` reference each `planId`.

```
For each weekLog in weekLogs:
  if weekLog.planId exists:
    count[weekLog.planId] += 1
    totalDays[weekLog.planId] += 7
    completedDays[weekLog.planId] += count of days where status == "complete"
```

Rank by `count` (descending). Take top 5.

For each entry compute:
- `rank`: 1-5
- `planId`: the routine plan ID
- `name`: from routinePlans catalog
- `totalWeeks`: the count
- `totalSessions`: sum of completed days across all weeks using this plan
- `adherenceRate`: (completedDays / totalDays) × 100

### 5.3 Personal Records

For each exercise with `usesWeight: true`, find the best performance.

**Important exercises for PRs** (these are the seeded exercises in the DB):

| exerciseKey | Exercise Name (Spanish) | Category |
|-------------|------------------------|----------|
| `squat` | Sentadilla | LEGS_FRONT |
| `bench_press` | Press de banca plano | CHEST |
| `incline_bench` | Press de banca inclinado | CHEST |
| `overhead_press` | Press militar | SHOULDERS |
| `barbell_row` | Remo con barra | BACK |
| `romanian_deadlift` | Peso muerto rumano | LEGS_POSTERIOR |
| `hip_thrust` | Hip thrust | LEGS_POSTERIOR |

**How to match:** The `exerciseKey` in `strengthMetrics` matches the Spanish exercise name (normalized). To map:
1. Get all exercises from the response
2. For each important exercise key above, find the matching exercise by name
3. Use that exercise's `id` to search in `workoutSessions`

**For each matched exercise, compute:**

For every session that includes this exercise:
```
for set in exercise.sets:
    weight = set.weights (ignore if null/0)
    reps = set.reps
    
    # Brzycki formula for 1RM estimation
    if reps >= 1 and reps <= 36:
        one_rm = weight * (36 / (37 - reps))
    
    # Volume for this set
    volume = weight * reps
```

Track per exercise:
- `bestWeight`: max weight lifted across all sets
- `bestReps`: reps at that best weight
- `bestVolume`: max (weight × reps × series) in a single session
- `oneRmEstimated`: max Brzycki 1RM across all sets
- `achievedAt`: date of the session where the best volume was recorded

For `previousOneRm`: look at `strengthMetrics[]` for this exercise's `exerciseKey` and get the `oneRmKg` of the most recent entry (by `measuredAt`). If none exists, set to `null`.

Only include exercises that appear in at least 1 completed session.

### 5.4 Adherence

For each `weekLog`, compute weekly adherence:

```
for each weekLog in weekLogs:
    totalDays = 7
    completedDays = count of days where status == "complete"
    skippedDays = count of days where status == "skipped"
    pendingDays = count of days where status == "pending"
    adherencePercent = (completedDays / totalDays) * 100
```

Only include weekLogs where at least 1 day has been acted upon (not all pending).

---

## 6. Save Results

After computing, call 4 mutations to save. All mutations use the same auth header.

### 6.1 saveTopExercises

```graphql
mutation SaveTopExercises($userId: ID!, $input: SaveTopExercisesInput!) {
  saveTopExercises(userId: $userId, input: $input) {
    id
    computedAt
  }
}
```

```json
{
  "userId": "<same userId>",
  "input": {
    "computedAt": "<ISO 8601 now>",
    "exercises": [
      {
        "rank": 1,
        "exerciseId": "<ObjectId>",
        "name": "Press de banca plano",
        "category": "chest",
        "totalSessions": 24,
        "totalVolume": 12500.5,
        "avgVolumePerSession": 520.86
      }
    ]
  }
}
```

### 6.2 saveTopRoutines

```graphql
mutation SaveTopRoutines($userId: ID!, $input: SaveTopRoutinesInput!) {
  saveTopRoutines(userId: $userId, input: $input) {
    id
    computedAt
  }
}
```

```json
{
  "userId": "<same userId>",
  "input": {
    "computedAt": "<ISO 8601 now>",
    "routines": [
      {
        "rank": 1,
        "planId": "<ObjectId>",
        "name": "PPL 6 dias",
        "totalWeeks": 12,
        "totalSessions": 60,
        "adherenceRate": 85.7
      }
    ]
  }
}
```

### 6.3 savePersonalRecords

```graphql
mutation SavePersonalRecords($userId: ID!, $input: SavePersonalRecordsInput!) {
  savePersonalRecords(userId: $userId, input: $input) {
    id
    computedAt
  }
}
```

```json
{
  "userId": "<same userId>",
  "input": {
    "computedAt": "<ISO 8601 now>",
    "records": [
      {
        "exerciseId": "<ObjectId>",
        "exerciseName": "Press de banca plano",
        "category": "chest",
        "oneRmEstimated": 85.5,
        "bestWeight": 70,
        "bestReps": 8,
        "bestVolume": 1680,
        "achievedAt": "2026-08-15T00:00:00.000Z",
        "previousOneRm": 80.0
      }
    ]
  }
}
```

### 6.4 saveAdherence

```graphql
mutation SaveAdherence($userId: ID!, $input: SaveAdherenceInput!) {
  saveAdherence(userId: $userId, input: $input) {
    id
    computedAt
  }
}
```

```json
{
  "userId": "<same userId>",
  "input": {
    "computedAt": "<ISO 8601 now>",
    "weeks": [
      {
        "weekStartDate": "2026-08-11T00:00:00.000Z",
        "totalDays": 7,
        "completedDays": 5,
        "skippedDays": 1,
        "pendingDays": 1,
        "adherencePercent": 71.43
      }
    ]
  }
}
```

---

## 7. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GRAPHQL_API_URL` | Yes | Full URL, e.g. `https://wave-fit-api.onrender.com/graphql` |
| `STATS_SERVICE_JWT` | Yes | Bearer token for API auth |
| `AWS_REGION` | If SQS trigger | AWS region |

---

## 8. Error Handling

- If `getRawDataForWorker` returns empty `workoutSessions` and `weekLogs`, still call all 4 save mutations with empty arrays (this clears stale stats).
- If any save mutation fails, log the error and retry once. If it fails again, send a dead-letter to SQS (don't block the queue).
- Never store raw data from the API — only computed stats.

---

## 9. Output

The Lambda returns nothing meaningful to SQS (SQS is fire-and-forget). All side effects are the 4 save mutations.

---

## 10. Reference: Exercise Category Values

These are the valid `category` values in the exercise catalog:

```
chest, back, legs, legs_front, legs_posterior, biceps, triceps,
shoulders, core, cardio, rest
```

---

## 11. Reference: WeekLog Day Status Values

```
pending   — day not yet acted upon
complete  — workout was done
skipped   — day was intentionally skipped
```
