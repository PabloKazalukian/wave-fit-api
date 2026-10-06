# Stats Charts â€” On-the-fly Date-Range Calculations (Frontend)

> **Status:** done
> **Priority:** high

## Context

> **Correction (2026-10-01) â€” `userId` was never cast to `ObjectId`.** All six calculators
> built their queries with the raw string from `extractUserId()` (`userId: userId as any`).
> Because `userId` resolves to `SchemaMixed` in the compiled schemas, Mongoose applied no
> implicit casting and those filters matched **zero** documents: `getStats1RmWeekly` and
> `getStatsExerciseTrend` returned `[]`, and the remaining four returned hollow skeletons
> (week keys present, but `exercises: []`, `muscles: []`, `routineKcal: null`,
> `totalKcal: 0`). The feature's own unit tests could not catch it because they asserted
> `expect(query.userId.toString()).toBe(...)`, which passes identically for a string and
> for an ObjectId. Fixed by casting explicitly with `new Types.ObjectId(userId)` at all 10
> query sites (the pattern from `ADR-0003` and
> `week-log.infrastructure/repositories/week-log.repository.ts`), and by hardening the six
> calculator specs to also assert `toBeInstanceOf(Types.ObjectId)`. Discovered while
> building `sdd/stats-charts-performance.spec.md`; see its `FR-007`, which records the perf
> budgets as a post-correction baseline, and `documents/legacy/plans/stats-charts-performance/plan.md`
> for the implementation record.

The frontend needs **chart data** for training statistics computed **on the fly over a date range** (`from`/`to`, capped at 4 months). The existing `stats` module is an **experimental, worker-fed pipeline**: NestJS publishes events to SQS, an external Lambda computes the 4 metrics, and NestJS only upserts the already-computed results, which are then read back with `getTopExercises`/`getTopRoutines`/`getPersonalRecords`/`getAdherence`. Those persisted metrics are **cumulative snapshots** with a single `computedAt`; there is **no date-range calculation** anywhere in the specs or the code (`get-*` use cases take only `userId`; `getRawDataForWorker` reads the full history with no date filter).

This Spec adds a **read-only, CQRS-style companion**: a new module `stats-charts` that calculates chart stats **in memory** by reading the tracking collections directly (`WorkoutSession`, `WeekLog`, `DayLog`, `ExtraSession`, `Exercise`, `UserWeightLog`, `RoutinePlan`, `RoutineDay`, `UserProfile`). It follows the existing resolver contract pattern (`trainingCalendar`): each query is the only way to obtain one calculation, receives a fixed window, and returns the data ready for a chart. No SQS, no worker, no persistence, no schema changes to tracking modules.

### Decisions (clarification, 2026-09-23)

| Topic | Decision |
|---|---|
| Window | The frontend always sends `from`/`to` (LocalDate `yyyy-MM-dd`). Cap: 4 months (120 days). No fixed default window. |
| 1RM empty weeks | Gap as `best1RM: null` + `participated: false` (chart connects the dots). |
| Muscle group | `Exercise.category` is the muscle key (`Exercise` has no `muscle` field). `RoutineDay.type` (an `ExerciseCategory[]`) is used only to derive the **expected** muscles of an active plan. |
| Calories (routines) | `WorkoutSession` has no calories and no duration â†’ `routineKcal` is always `null`. Only `ExtraSession` contributes. |
| Calories (ExtraSession) | Manual `calories` override wins; otherwise estimate `MET Ã— weightKg Ã— (duration/60)` with the discipline MET from `EXTRA_SESSION_DISCIPLINES` and the user's latest `UserWeightLog` (`loggedAt <= es.date`), falling back to `UserProfile.weightKg`. Without a weight â†’ that session contributes `0`. |
| Expected muscles ("forgotten") | Muscles of the active plan: `WeekLog.active` â†’ `planId` (â†’ `RoutinePlan.week[].day` â†’ `RoutineDay.type`) or `DayLog.active` â†’ `routineDayId` (â†’ `RoutineDay.type`), union of both. Fallback when there is no active plan or no routine roads: the full `ExerciseCategory` catalog. |
| ExtraSession â†’ worker | No event emitted (extra sessions never have sets/weights; the on-the-fly queries read the DB directly). |
| Thresholds | Module-level config constants (not env vars). |
| One query = one stat | Each query returns exactly one calculation for its fixed window; there is no multi-stat/multi-window negotiation in a single request. |
| Gate scope | Module-scope gate: `npx jest --config jest.config.js src/modules/stats-charts`, `npm run build`, `npm run lint`. The full-repo `npm test` still fails on pre-existing, unrelated spec type errors (audit-logs interceptor, exercise.service, routine-plan resolver/service, training-history.service, week-log.resolver) â€” excluded from this feature's gate. |

## Requirements

### Functional Requirements

- `FR-001` â€” New module `src/modules/stats-charts/` registered in `src/app.module.ts`. It is **read-only**: it queries tracking data and computes in memory; it never writes, never publishes to SQS, and never needs a worker or a service JWT.
- `FR-002` â€” Schema registration avoids Mongoose model-name collision with the `stats` reference models (`WorkoutSession`, `WeekLog` already registered on the same connection). The module registers the **real tracking schemas** under aliased model names with an explicit `collection` mapping, e.g. `{ name: 'StatsChartsWorkoutSession', schema: WorkoutSessionSchema, collection: 'workoutsessions' }` (and the same pattern for `weeklogs`, `daylogs`, `extrasessions`, `exercises`, `userweightlogs`, `routineplans`, `routinedays`, `userprofiles`).
- `FR-003` â€” Each chart query is decorated with `GqlAuthGuard` and obtains `userId` from the context (`extractUserId`), mirroring `trainingCalendar`.
- `FR-004` â€” Common input `StatsChartsInput { from: LocalDate, to: LocalDate, timezone?: string }`, validations: both dates valid `yyyy-MM-dd` (`isValidLocalDate`), `from <= to`, span `<= STATS_CHARTS_MAX_RANGE_DAYS` (`120`), timezone defaults to `STATS_CHARTS_DEFAULT_TIMEZONE` (`'America/Argentina/Buenos_Aires'`). Violations throw `BadRequestException`.
- `FR-005` â€” ISO-week key helper: for each date, `weekKey = \`${isoWeekYear}-W${isoWeek}\`` computed from the **local date** (`utcToLocalDate`) via `date-fns` `getISOWeekYear`/`getISOWeek`. The window always yields a **continuous** list of week keys (starting at the week containing `from`, ending at the week containing `to`), and each calculator emits every key even when there is no data.
- `FR-006` â€” Query `getStats1RmWeekly` â†’ `[Exercise1RmWeekly]`: per `exerciseId` (with `name`/`category` from the catalog) a weekly series. Rule: Epley `1RM = weight Ã— (1 + reps/30)` on the **best set of the week** (max 1RM; tie-break by heavier `weightUsed`, then highest `reps`). Eligible sets: `reps >= 1`, `reps <= STATS_CHARTS_MAX_1RM_REPS` (`12`), and `(weights ?? 0) > 0`. Sets without weight or with `reps > 12` are ignored. A week without eligible sets for the exercise â†’ `best1RM: null`, `weightUsed: null`, `reps: null`, `participated: false`.
- `FR-007` â€” Query `getStatsVolumeWeekly` â†’ `[VolumeWeeklyEntry]`: per `weekKey`, (a) `exercises[]` volume per exercise and (b) `muscles[]` sets & volume per muscle. Volume per set = `reps Ã— weights` (set without weight â†’ contributes `0`). Muscle = `exercise.category`. Muscle `sets` counts only sets with `reps >= 1`. `ExtraSession` never contributes (it has no sets/weights) â€” documented, not silent.
- `FR-008` â€” Query `getStatsVolumeTotalWeekly` â†’ `[VolumeTotalWeeklyEntry]`: per `weekKey`, `totalVolume` = sum of all set volumes over completed sessions in the window, `deltaPct = (actual âˆ’ previous) / previous Ã— 100` where `previous` is the immediately preceding week key in the returned series; `deltaPct` is `null` when `previous` does not exist or equals `0` (never `Infinity`). `possibleDeload = deltaPct !== null && deltaPct <= STATS_CHARTS_DELOAD_THRESHOLD_PCT` (`-30`).
- `FR-009` â€” Query `getStatsCaloriesWeekly` â†’ `[CaloriesWeeklyEntry]`: per `weekKey`, `routineKcal` always `null`, `extraKcal` = sum over `ExtraSession` documents in the window (`manual calories` if present, else `MET Ã— weightKg Ã— duration/60`), `totalKcal = extraKcal`, and `estimatedSessions` = number of sessions whose kcal came from estimation (count with a manual override excluded). Without a weight source for a session â†’ that session contributes `0` (not estimated).
- `FR-010` â€” Query `getStatsForgottenMuscles` â†’ `[ForgottenMuscle]`: expected muscles come from the active plan (see Decisions, union of `WeekLog.active`/`DayLog.active` plan-derived muscles); when no active plan or no routable routine exists, fall back to the full `ExerciseCategory` catalog. A muscle is flagged when its `totalSets` in the window is `< STATS_CHARTS_MIN_SETS_PER_WEEK Ã— (number of ISO weeks in the window)` or `0`. Output per muscle: `totalSets`, `weeksWithoutWork` (ISO weeks with `0` sets), `lastTrainedAt` (date of the most recent set, `null` if never trained). Sorted by severity: `totalSets` ascending, then `weeksWithoutWork` descending, then `lastTrainedAt` ascending.
- `FR-011` â€” Query `getStatsExerciseTrend` â†’ `[ExerciseTrend]`: simple linear regression of the weekly best 1RM (per `FR-006` eligibility, weeks with `participated: true`); `x` = 0-based week index, `y` = weekly best 1RM. `slope` = least-squares slope, `pctChange = slope / mean(best1RM) Ã— 100`. Label: `up` when `pctChange > STATS_CHARTS_TREND_THRESHOLD_PCT` (`+2`), `down` when `< âˆ’threshold`, `flat` otherwise. When `weeksUsed < STATS_CHARTS_MIN_TREND_WEEKS` (`3`) â†’ `label: 'insufficient'` and `slope`/`pctChange` are `null`. Output also carries `weeksUsed`.

### Business Rules

- `BR-001` â€” The six calculations are **pure reads** over the current state of the tracking collections; results are never persisted and a chart query never triggers an event or the worker.
- `BR-002` â€” A chart query returns at most one calculation for a fixed window (one query = one stat). There is no way to negotiate multiple stats or a mutable window inside the same request.
- `BR-003` â€” `routineKcal` is always `null` for as long as `WorkoutSession` has no calories and no duration; the API must not invent a routine kcal value.
- `BR-004` â€” `deltaPct` must never be `Infinity`/`NaN`; weeks with no previous positive volume expose `null`.
- `BR-005` â€” All weekly windows are derived from the user's local timezone (input `timezone`, default `'America/Argentina/Buenos_Aires'`), consistent with the rest of tracking modules (`NFR-001` of `sdd/day-log.spec.md`).

### Non-Functional Requirements

- `NFR-001` â€” Read-only and safe by design: no schema change to any tracking module, no migration, no new env vars, no SQS/DLQ/audit involvement. The existing `stats` module and its worker contract are untouched.
- `NFR-002` â€” Thresholds and tuning live in `src/modules/stats-charts/stats-charts.config.ts` as named constants with the values documented above; they are not env vars.
- `NFR-003` â€” Calculations are deterministic and timezone-consistent; the code reuses `utcToLocalDate`, `isValidLocalDate`, `DEFAULT_TIMEZONE` from `src/common/utils/date.utils` rather than re-implementing date logic.
- `NFR-004` â€” Code, technical documentation and identifiers in English (Charter Â§8); user-facing category/muscle keys are the enum values (`chest`, `back`, â€¦) and the frontend owns display labels.
- `NFR-005` â€” Unit tests use the mock-pattern rules of `documents/engineering/testing.md` Â§6: mongoose model tokens are provided as `jest.fn()` value objects keyed by the aliased model-name tokens used for injection.
- `NFR-006` â€” The module is production-active (it is pure read/compute with no external dependencies), but it must not regress the `stats` experimental gate: it does not touch `src/modules/stats/`.

## Constraints

- Do **not** modify any tracking module (`workout-session`, `week-log`, `day-log`, `extra-session`) or `src/modules/stats/`. No schema, resolver, event, or contract changes there.
- Do **not** add SQS, workers, cron, persistence, caching, or service-JWT operations.
- Do **not** add env configuration for thresholds (module constants only).
- Do **not** invent kcal data for routines, do **not** infer `deltaPct` from `0`/missing previous weeks, and do **not** quit the 1RM series by dropping weeks.
- The 4-month cap is enforced per query; there is no server-side default window.

## Architecture

```
Frontend chart query (GqlAuthGuard, userId from context)
      â†“  StatsChartsInput { from, to, timezone? }  (validated, â‰¤ 120 days)
StatsChartsResolver (6 read queries)
      â†“
StatsChartsService (facade)
      â†“
calculators/ (pure, one per stat, unit-tested)
      â”‚    1rm-weekly    â†’ Exercise1RmWeekly[]
      â”‚    volume-weekly â†’ VolumeWeeklyEntry[]   {exercises, muscles}
      â”‚    volume-total  â†’ VolumeTotalWeeklyEntry[]
      â”‚    calories      â†’ CaloriesWeeklyEntry[]
      â”‚    forgotten     â†’ ForgottenMuscle[]
      â”‚    trend         â†’ ExerciseTrend[]
      â†“
common/range.utils.ts  (window validation, ISO week keys)
infrastructure/        (aliased Mongoose models â†’ real collections)
```

Data sources (all scoped to `userId`, `deleted: { $ne: true }`, and the `[from, to]` window where the collection has a date):

| Collection | Used by | Window filter |
|---|---|---|
| `workoutsessions` (completed) | 1RM, volume, volume-total, forgotten, trend | `date` in window |
| `extrasessions` | calories | `date` in window |
| `weeklogs` (active) + `routineplans` + `routinedays` | forgotten expected muscles | â€” |
| `daylogs` (active) + `routinedays` | forgotten expected muscles | â€” |
| `exercises` | names/categories, catalog fallback | â€” |
| `userweightlogs` (+ `userprofiles` fallback) | calories weight | `loggedAt <= es.date` |

## Files

- `sdd/stats-charts.spec.md` (new â€” this Spec)
- `documents/plans/stats-charts/plan.md` (new â€” implementation plan, Active/Pending)
- `src/modules/stats-charts/stats-charts.module.ts` (new)
- `src/modules/stats-charts/stats-charts.resolver.ts` (new)
- `src/modules/stats-charts/stats-charts.service.ts` (new)
- `src/modules/stats-charts/stats-charts.config.ts` (new)
- `src/modules/stats-charts/common/range.utils.ts` (new)
- `src/modules/stats-charts/calculators/one-rm-weekly.calculator.ts` (new)
- `src/modules/stats-charts/calculators/volume-weekly.calculator.ts` (new)
- `src/modules/stats-charts/calculators/volume-total.calculator.ts` (new)
- `src/modules/stats-charts/calculators/calories.calculator.ts` (new)
- `src/modules/stats-charts/calculators/forgotten-muscles.calculator.ts` (new)
- `src/modules/stats-charts/calculators/trend.calculator.ts` (new)
- `src/modules/stats-charts/presentation/dto/stats-charts.input.ts` (new)
- `src/modules/stats-charts/presentation/entities/*.output.ts` (new: the 6 chart outputs)
- `src/modules/stats-charts/**/*.spec.ts` (new: unit tests, see Tests)
- `src/app.module.ts` (modify: import `StatsChartsModule`)

## Tests

- `TEST-001` â€” `range.utils.spec.ts`: invalid/`from > to`/`> 120` day windows throw `BadRequestException`; timezone default; continuous ISO-week key list across month/year borders. Proves `FR-004`, `FR-005`, `BR-005`.
- `TEST-002` â€” `one-rm-weekly.calculator.spec.ts`: Epley math, top-set selection (not average), eligibility filter (`reps > 12`, no weight), tie-break, weekly gaps (`null` + `participated: false`). Proves `FR-006`.
- `TEST-003` â€” `volume-weekly.calculator.spec.ts`: per-exercise volume, per-muscle sets/volume, weightless sets â†’ `0`, `ExtraSession` excluded. Proves `FR-007`.
- `TEST-004` â€” `volume-total.calculator.spec.ts`: weekly totals, `deltaPct` `null` on missing/zero previous, deload flag at threshold. Proves `FR-008`, `BR-004`.
- `TEST-005` â€” `calories.calculator.spec.ts`: manual override wins, MET estimation with the latest weight log, `UserProfile` fallback, no-weight â†’ `0`, `estimatedSessions`, `routineKcal: null`. Proves `FR-009`, `BR-003`.
- `TEST-006` â€” `forgotten-muscles.calculator.spec.ts`: expected muscles from active `WeekLog`/`DayLog` plan, catalog fallback, threshold filtering, `weeksWithoutWork`/`lastTrainedAt`, severity ordering. Proves `FR-010`.
- `TEST-007` â€” `trend.calculator.spec.ts`: least-squares slope, `pctChange`, up/flat/down labels at Â±2 %, `insufficient` below 3 weeks. Proves `FR-011`.
- `TEST-008` â€” `stats-charts.resolver.spec.ts`: the 6 query names/params and `GqlAuthGuard` decorator; each delegates `userId` + mapped input to the service. Proves `FR-003`, `FR-004`.
- `TEST-009` â€” Targeted run green: `npx jest --config jest.config.js src/modules/stats-charts`.
- `TEST-010` â€” Module gate green: `npm run build`, `npm run lint`, and targeted `npx jest --config jest.config.js src/modules/stats-charts` (73 tests / 8 suites). No tracking/`stats` files touched. The full-repo `npm test` remains red only on pre-existing, unrelated spec type errors â€” out of scope, see Decisions. `TEST-010` does not cover GraphQL schema generation (that happens at app boot) â€” `TEST-011` covers it.
- `TEST-011` â€” `stats-charts.schema.spec.ts`: builds the code-first GraphQL schema headlessly via `GraphQLSchemaBuilder` (`@nestjs/graphql`) with `StatsChartsResolver` and asserts the printed SDL contains the 6 `getStats*` queries and `lastTrainedAt: DateTime`. This reproduces the app boot path and proves `AC-003` (schema generates without undefined-type errors) inside the module gate. Proves `AC-001`, `AC-003`, `NFR-004`.

## Acceptance Criteria

- `AC-001` â€” Six `getStats*` queries exist under `stats-charts`, user-scoped via `GqlAuthGuard`, each returning exactly one calculation for the validated `[from, to]` window (max 120 days).
- `AC-002` â€” Each calculation matches its documented output shape and edge-case semantics (1RM gaps, `deltaPct: null`, `routineKcal: null`, `insufficient` trend, severity ordering).
- `AC-003` â€” The module boots alongside the existing `stats` reference models without Mongoose model-name collision (proven by `npm run build` + `npm test`).
- `AC-004` â€” No file under `src/modules/stats/` or any tracking module was modified; no SQS/persistence/env config was added.
- `AC-005` â€” `npm run build`, `npm run lint`, and the targeted `stats-charts` jest run pass (module-scope gate). The full-repo `npm test` remains red only on pre-existing, unrelated failures â€” see Decisions.