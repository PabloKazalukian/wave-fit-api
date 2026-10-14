# Stats Charts Module â€” On-the-fly Date-Range Chart Calculations

> Part of the stable module documentation. Specs live under `sdd/`; this document describes the implemented system state.
> **Status:** Current
> **Last updated:** 2026-10-01
> **Spec:** `sdd/stats-charts.spec.md` (done, authoritative); `sdd/stats-charts-performance.spec.md` (performance layer, done)

## Purpose

The `stats-charts` module is a **read-only, CQRS-style companion** to the experimental `stats` pipeline. The frontend needs **chart data computed on the fly over a date range** (`from`/`to`, capped at 120 days). Unlike `stats` (SQS â†’ Lambda â†’ persisted snapshots), this module queries the tracking collections directly and computes the six charts **in memory**. It never writes, never publishes to SQS, never needs a worker or a service JWT, and it touches no file under `src/modules/stats/` or any tracking module.

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
      â†“  StatsChartsInput { from, to, timezone? }  (validated, â‰¤ 120 days)
StatsChartsResolver (6 read queries)
      â†“
StatsChartsService (facade)
      â†“
calculators/ (pure, one per stat, unit-tested)
      â””â”€â”€ one-rm-weekly / volume-weekly / volume-total / calories / forgotten-muscles / trend
      â†“
common/range.utils.ts   (window validation, ISO week keys)
common/strength.utils.ts (Epley 1RM, eligibility, weekly best map)
infrastructure/         (aliased Mongoose models â†’ real collections)
```

- `stats-charts.module.ts` registers the **real tracking schemas under aliased model names** with an explicit `collection` mapping to avoid Mongoose model-name collision with the `stats` reference models (e.g. `{ name: 'StatsChartsWorkoutSession', schema: WorkoutSessionSchema, collection: 'workoutsessions' }`, and the same pattern for `weeklogs`, `daylogs`, `extrasessions`, `exercises`, `userweightlogs`, `routineplans`, `routinedays`, `userprofiles`).
- `StatsChartsService` is the facade: each method validates the window and delegates to its calculator. `StatsChartsModule` exports `StatsChartsService`.

## Data sources

All reads are scoped to `userId`, `deleted: { $ne: true }`, and the `[from, to]` window where the collection has a date:

| Collection | Used by | Window filter |
|---|---|---|
| `workoutsessions` (completed) | 1RM, volume, volume-total, forgotten, trend | `date` in window |
| `extrasessions` | calories | `date` in window |
| `weeklogs` (active) + `routineplans` + `routinedays` | forgotten expected muscles | â€” |
| `daylogs` (active) + `routinedays` | forgotten expected muscles | â€” |
| `exercises` | names/categories, catalog fallback | â€” |
| `userweightlogs` (+ `userprofiles` fallback) | calories weight | `loggedAt <= es.date` |

## Calculation semantics

- **Week keys:** continuous ISO-week list (`isoweek-Www` via `getISOWeekYear`/`getISOWeek`) computed from the **local date** (`utcToLocalDate`) in the user timezone (input `timezone`, default `'America/Argentina/Buenos_Aires'`). Every key is emitted even when there is no data.
- **1RM (Epley):** `1RM = weight Ã— (1 + reps/30)` on the best set of the week (tie-break: heavier `weightUsed`, then highest `reps`). Eligible sets: `1 <= reps <= 12` and `weight > 0`. A week without eligible sets â†’ `best1RM: null`, `participated: false`.
- **Volume:** per set = `reps Ã— weights` (weightless set â†’ `0`); muscle = `exercise.category`; muscle `sets` counts only sets with `reps >= 1`. `ExtraSession` never contributes (it has no sets/weights).
- **deltaPct:** `(actual âˆ’ previous) / previous Ã— 100` vs the immediately preceding week in the series; `null` when previous is missing or `0`. `possibleDeload = deltaPct !== null && deltaPct <= -30`.
- **Calories:** `routineKcal` always `null` (no calories/duration on `WorkoutSession`). `extraKcal` = manual `calories` override, else `MET Ã— weightKg Ã— (duration/60)` with the discipline MET from `EXTRA_SESSION_DISCIPLINES` and the latest `UserWeightLog` (`loggedAt <= es.date`), falling back to `UserProfile.weightKg`; no weight â†’ `0`. `estimatedSessions` counts sessions whose kcal came from estimation.
- **Forgotten muscles:** expected muscles = union of active-plan Routs (`WeekLog.active` â†’ `planId` â†’ `RoutinePlan.week[].day` â†’ `RoutineDay.type` and `DayLog.active` â†’ `routineDayId` â†’ `RoutineDay.type`); fallback to the full `ExerciseCategory` catalog (excluding `rest`) when there is no active plan. Flagged when `totalSets < 2 Ã— number of ISO weeks` or `0`. `lastTrainedAt` is the date of the most recent set. Sort: `totalSets` asc, `weeksWithoutWork` desc, `lastTrainedAt` asc.
- **Trend:** least-squares regression over the weekly best 1RM (`x` = 0-based week index); `pctChange = slope / mean Ã— 100`; labels `up` (> +2%), `down` (< âˆ’2%), `flat`; `weeksUsed < 3` â†’ `insufficient` with `slope`/`pctChange` = `null`.

## Measured performance baseline

Recorded, **not fixed** (`BR-007` of `sdd/stats-charts-performance.spec.md`). These are the inputs a future optimization Spec should start from. No query below was remediated here, and any change to them is expected to turn `test/perf/stats-charts.bench.spec.ts` red.

| | `small` (28d hist / 28d win) | `medium` (120d / 120d) | `large` (546d / 120d) |
|---|---|---|---|
| `getStats1RmWeekly` | 2 queries / 42 docs | 2 / 98 | 2 / 98 |
| `getStatsVolumeWeekly` | 2 / 42 | 2 / 98 | 2 / 98 |
| `getStatsVolumeTotalWeekly` | 1 / 12 | 1 / 68 | 1 / 68 |
| `getStatsCaloriesWeekly` | 3 / 10 | 3 / 36 | **3 / 97** |
| `getStatsForgottenMuscles` | 6 / 51 | 6 / 107 | 6 / 107 |
| `getStatsExerciseTrend` | 2 / 42 | 2 / 98 | 2 / 98 |
| dashboard (all six) | 16 / 199 | 16 / 505 | **16 / 566** |

`queries` and `docsReturned` are exact integers, so they describe the code rather than the machine. `elapsedMs` is reported but never asserted by default (`BR-002`); it is only enforced when `PERF_ENFORCE_TIMING=1`. Run with `npm run test:perf`.

### Hotspots

1. **Duplicated session read.** `one-rm-weekly`, `volume-weekly`, `forgotten-muscles` and `trend` each issue a byte-identical `workoutsessions` query (`userId` + `deleted: { $ne: true }` + `status: 'complete'` + `date` in window, sorted by `date`) â€” `one-rm-weekly.calculator.ts:51`, `volume-weekly.calculator.ts:48`, `forgotten-muscles.calculator.ts:80`, `trend.calculator.ts:56`. On the dashboard that is 4 of the 16 queries reading the same documents.
2. **Unfiltered catalog read.** The same four calculators each run a full `exercises.find()` with no filter, no projection and no limit â€” `one-rm-weekly.calculator.ts:61`, `volume-weekly.calculator.ts:58`, `forgotten-muscles.calculator.ts:90`, `trend.calculator.ts:66`. `exercises` has no index that can serve a bare `find()`, so this is a collection scan that returns the entire catalog (30 docs in the dataset) on every request.
3. **No projections.** Not one read in the module uses `.select()`, so every query materializes full documents into Node memory. This is what `docsReturned` makes visible: 97 documents for a single `getStatsCaloriesWeekly` call on `large`.
4. **Unbounded weight-log scan.** `getStatsCaloriesWeekly` reads `userweightlogs` with `loggedAt: { $lte: toUtc }` and **no lower bound** (`calories.calculator.ts:61`), so it materializes the user's entire weigh-in history. It is the only read not bounded by `STATS_CHARTS_MAX_RANGE_DAYS`.

### `medium` vs `large` divergence

`large` keeps the measured window at 120 days but extends history to 546 days. Every window-bounded query is unaffected â€” `oneRmWeekly`, `volumeWeekly`, `exerciseTrend` and `volumeTotalWeekly` stay at 98/68 documents whether history is 120 or 546 days. Only `getStatsCaloriesWeekly` grows, and it grows because of hotspot 4, not because of the window:

| | `medium` | `large` |
|---|---|---|
| `getStatsCaloriesWeekly` docs | 36 | **97** |
| `getStatsVolumeTotalWeekly` docs | 68 | 68 |
| dashboard docs | 505 | **566** |

At `medium` the 36 documents are 17 in-window extra sessions + 18 weight logs + 1 profile. At `large` the 17 in-window extra sessions and 1 profile are unchanged, but **all 79 weight logs across the full 546-day history** are returned: `17 + 79 + 1 = 97`. The dashboard inherits the growth (505 â†’ 566) through this single query. This divergence is asserted as `TEST-005` so that bounding the weight-log read â€” or failing to bound it â€” both surface as a test failure rather than as a silent latency regression.

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

Unit suites under `src/modules/stats-charts/` (range.utils, strength utils, the 6 calculators, the resolver, and a schema-generation guard) follow the mock patterns of `documents/engineering/testing.md` Â§6. Run with `npx jest --config jest.config.js src/modules/stats-charts` (9 suites). The `stats-charts.schema.spec.ts` guard builds the code-first GraphQL schema headlessly via `GraphQLSchemaFactory` (`@nestjs/graphql`) and asserts the printed SDL contains the 6 queries and `lastTrainedAt: DateTime` â€” it reproduces the app-boot schema generation so undefined-type regressions are caught inside the module gate (they are invisible to `build`/`lint`/plain unit tests).

The six calculator specs assert that each query receives an `ObjectId` for `userId` (`toBeInstanceOf(Types.ObjectId)`), not merely that `userId.toString()` equals the fixture id. That distinction is load-bearing: a string assertion passes for both a string and an ObjectId, and every calculator here previously passed the raw string through, so all six queries matched zero documents against real data (`ADR-0003`).

## Performance layer

An independent benchmark harness lives at `test/perf/` (Spec: `sdd/stats-charts-performance.spec.md`), run with `npm run test:perf`. It boots its own in-memory MongoDB, seeds a deterministic dataset for three sizes, and asserts exact `queries` / `docsReturned` against `test/perf/stats-charts.budget.ts`. It is excluded from `npm test` and `npm run test:e2e`, changes no application behavior, and is deliberately **not** a timing test by default.

A second, end-to-end layer drives the real GraphQL API with k6: `npm run perf:seed` builds the dataset for a perf user and `npm run test:perf:k6` runs seven scenarios (six charts plus a single-request dashboard) against `POST /graphql`, exporting a summary to `test/perf/results/k6-summary.json`. Its contract is asserted in `test/perf/perf-artifacts.spec.ts` (`k6 inspect`), plus `test/perf/k6-queries.spec.ts`, which validates every query document against the real code-first schema. `.github/workflows/perf.yml` is configured to run on a nightly schedule, never on a pull request.

**Validated 2026-10-02** with a full manual run (`medium`, 120-day window, seven scenarios at 1 iteration/s for 30 s against a live API on the isolated Mongo container): 215 requests, `http_req_failed` 0.00%, **643 checks passed and 0 failed**, `http_req_duration` avg 112 ms / med 110 ms / p95 158 ms / max 245 ms, inside the `p(95) < 2000` threshold. The `checks` count is the load-bearing part: every scenario asserts the response carries seeded data, so these timings describe real calculations rather than empty arrays. Treat them as a **machine-specific reference point, not a portable baseline** â€” only the `queries` / `docsReturned` budgets above are asserted in CI, because wall-clock timings are not comparable across machines.

## Status

- **Registered** in `app.module.ts` and **production-active** (pure read/compute, no external dependencies).
- **Implemented:** module + aliased schema registration, 6 calculators, facade service, resolver with `GqlAuthGuard` + window validation, resolver spec that proves query names/metadata, guard, delegation and `BadRequestException` on invalid windows, and a schema-generation guard.
- **Corrected 2026-10-01:** all six calculators cast `userId` with `new Types.ObjectId(...)` at the query boundary. They previously passed the raw string, and because `userId` resolves to `SchemaMixed` no implicit casting occurred, so every user-scoped filter matched zero documents (`ADR-0003`).
- **Gate:** module-scope gate green (`build`, `lint`, targeted jest). Full-repo `npm test` and `npm run test:e2e` are green as of 2026-10-01; the pre-existing unrelated spec type errors noted earlier are resolved.