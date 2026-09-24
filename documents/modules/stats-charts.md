# Stats Charts Module — On-the-fly Date-Range Chart Calculations

> Part of the stable module documentation. Specs live under `sdd/`; this document describes the implemented system state.
> **Status:** Current
> **Last updated:** 2026-09-23
> **Spec:** `sdd/stats-charts.spec.md` (done, authoritative)

## Purpose

The `stats-charts` module is a **read-only, CQRS-style companion** to the experimental `stats` pipeline. The frontend needs **chart data computed on the fly over a date range** (`from`/`to`, capped at 120 days). Unlike `stats` (SQS → Lambda → persisted snapshots), this module queries the tracking collections directly and computes the six charts **in memory**. It never writes, never publishes to SQS, never needs a worker or a service JWT, and it touches no file under `src/modules/stats/` or any tracking module.

## Queries

All six queries are decorated with `GqlAuthGuard` (user cookie JWT); `userId` is obtained from the context via `extractUserId`, mirroring `trainingCalendar`. Each query receives the common input `StatsChartsInput { from: LocalDate, to: LocalDate, timezone?: string }` and returns exactly one calculation for that fixed window.

| Query | Returns | What it computes |
|---|---|---|
| `getStats1RmWeekly` | `[Exercise1RmWeekly]` | Per exercise, a weekly series of the best estimated 1RM |
| `getStatsVolumeWeekly` | `[VolumeWeeklyEntry]` | Per week: volume per exercise and sets/volume per muscle |
| `getStatsVolumeTotalWeekly` | `[VolumeTotalWeeklyEntry]` | Per week: total volume plus `deltaPct` vs the previous week and a `possibleDeload` flag |
| `getStatsCaloriesWeekly` | `[CaloriesWeeklyEntry]` | Per week: `routineKcal` (always `null`), `extraKcal`, `totalKcal`, `estimatedSessions` |
| `getStatsForgottenMuscles` | `[ForgottenMuscle]` | Muscles trained less than the weekly minimum across the window, ordered by severity |
| `getStatsExerciseTrend` | `[ExerciseTrend]` | Linear regression of the weekly best 1RM (up/flat/down/insufficient) |

## Architecture

```
Frontend chart query (GqlAuthGuard, userId from context)
      ↓  StatsChartsInput { from, to, timezone? }  (validated, ≤ 120 days)
StatsChartsResolver (6 read queries)
      ↓
StatsChartsService (facade)
      ↓
calculators/ (pure, one per stat, unit-tested)
      └── one-rm-weekly / volume-weekly / volume-total / calories / forgotten-muscles / trend
      ↓
common/range.utils.ts   (window validation, ISO week keys)
common/strength.utils.ts (Epley 1RM, eligibility, weekly best map)
infrastructure/         (aliased Mongoose models → real collections)
```

- `stats-charts.module.ts` registers the **real tracking schemas under aliased model names** with an explicit `collection` mapping to avoid Mongoose model-name collision with the `stats` reference models (e.g. `{ name: 'StatsChartsWorkoutSession', schema: WorkoutSessionSchema, collection: 'workoutsessions' }`, and the same pattern for `weeklogs`, `daylogs`, `extrasessions`, `exercises`, `userweightlogs`, `routineplans`, `routinedays`, `userprofiles`).
- `StatsChartsService` is the facade: each method validates the window and delegates to its calculator. `StatsChartsModule` exports `StatsChartsService`.

## Data sources

All reads are scoped to `userId`, `deleted: { $ne: true }`, and the `[from, to]` window where the collection has a date:

| Collection | Used by | Window filter |
|---|---|---|
| `workoutsessions` (completed) | 1RM, volume, volume-total, forgotten, trend | `date` in window |
| `extrasessions` | calories | `date` in window |
| `weeklogs` (active) + `routineplans` + `routinedays` | forgotten expected muscles | — |
| `daylogs` (active) + `routinedays` | forgotten expected muscles | — |
| `exercises` | names/categories, catalog fallback | — |
| `userweightlogs` (+ `userprofiles` fallback) | calories weight | `loggedAt <= es.date` |

## Calculation semantics

- **Week keys:** continuous ISO-week list (`isoweek-Www` via `getISOWeekYear`/`getISOWeek`) computed from the **local date** (`utcToLocalDate`) in the user timezone (input `timezone`, default `'America/Argentina/Buenos_Aires'`). Every key is emitted even when there is no data.
- **1RM (Epley):** `1RM = weight × (1 + reps/30)` on the best set of the week (tie-break: heavier `weightUsed`, then highest `reps`). Eligible sets: `1 <= reps <= 12` and `weight > 0`. A week without eligible sets → `best1RM: null`, `participated: false`.
- **Volume:** per set = `reps × weights` (weightless set → `0`); muscle = `exercise.category`; muscle `sets` counts only sets with `reps >= 1`. `ExtraSession` never contributes (it has no sets/weights).
- **deltaPct:** `(actual − previous) / previous × 100` vs the immediately preceding week in the series; `null` when previous is missing or `0`. `possibleDeload = deltaPct !== null && deltaPct <= -30`.
- **Calories:** `routineKcal` always `null` (no calories/duration on `WorkoutSession`). `extraKcal` = manual `calories` override, else `MET × weightKg × (duration/60)` with the discipline MET from `EXTRA_SESSION_DISCIPLINES` and the latest `UserWeightLog` (`loggedAt <= es.date`), falling back to `UserProfile.weightKg`; no weight → `0`. `estimatedSessions` counts sessions whose kcal came from estimation.
- **Forgotten muscles:** expected muscles = union of active-plan Routs (`WeekLog.active` → `planId` → `RoutinePlan.week[].day` → `RoutineDay.type` and `DayLog.active` → `routineDayId` → `RoutineDay.type`); fallback to the full `ExerciseCategory` catalog (excluding `rest`) when there is no active plan. Flagged when `totalSets < 2 × number of ISO weeks` or `0`. `lastTrainedAt` is the date of the most recent set. Sort: `totalSets` asc, `weeksWithoutWork` desc, `lastTrainedAt` asc.
- **Trend:** least-squares regression over the weekly best 1RM (`x` = 0-based week index); `pctChange = slope / mean × 100`; labels `up` (> +2%), `down` (< −2%), `flat`; `weeksUsed < 3` → `insufficient` with `slope`/`pctChange` = `null`.

## Configuration

Thresholds and tuning live in `src/modules/stats-charts/stats-charts.config.ts` as named constants (not env vars):

| Constant | Value | Meaning |
|---|---|---|
| `STATS_CHARTS_MAX_RANGE_DAYS` | `120` | Max window span |
| `STATS_CHARTS_DELOAD_THRESHOLD_PCT` | `-30` | Deload flag threshold |
| `STATS_CHARTS_TREND_THRESHOLD_PCT` | `2` | Up/down trend label threshold |
| `STATS_CHARTS_MIN_TREND_WEEKS` | `3` | Minimum weeks for a trend |
| `STATS_CHARTS_MIN_SETS_PER_WEEK` | `2` | Minimum sets/week to consider a muscle trained |
| `STATS_CHARTS_MAX_1RM_REPS` | `12` | Max reps for 1RM eligibility |
| `STATS_CHARTS_DEFAULT_TIMEZONE` | `America/Argentina/Buenos_Aires` | Timezone default |

## Tests

Unit suites under `src/modules/stats-charts/` (range.utils, strength utils, the 6 calculators, the resolver, and a schema-generation guard) follow the mock patterns of `documents/engineering/testing.md` §6. Run with `npx jest --config jest.config.js src/modules/stats-charts` (9 suites). The `stats-charts.schema.spec.ts` guard builds the code-first GraphQL schema headlessly via `GraphQLSchemaFactory` (`@nestjs/graphql`) and asserts the printed SDL contains the 6 queries and `lastTrainedAt: DateTime` — it reproduces the app-boot schema generation so undefined-type regressions are caught inside the module gate (they are invisible to `build`/`lint`/plain unit tests).

## Status

- **Registered** in `app.module.ts` and **production-active** (pure read/compute, no external dependencies).
- **Implemented:** module + aliased schema registration, 6 calculators, facade service, resolver with `GqlAuthGuard` + window validation, resolver spec that proves query names/metadata, guard, delegation and `BadRequestException` on invalid windows, and a schema-generation guard.
- **Gate:** module-scope gate green (`build`, `lint`, targeted jest). The full-repo `npm test` remains red only on pre-existing, unrelated spec type errors (audit-logs interceptor, exercise.service, routine-plan resolver/service, training-history.service, week-log.resolver) — excluded from this module's gate, see Decisions in the Spec.