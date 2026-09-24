# Plan — Stats Charts (On-the-fly Date-Range Calculations)

> **Status:** Historical / Non-Authoritative
> **Feature contract:** `sdd/stats-charts.spec.md` (done, authoritative)
> **Branch:** `feat/stats-charts`
> **Last updated:** 2026-09-23
> **Closed:** 2026-09-23 — implemented and validated; the current behavior is defined by the Spec (`status: done`) and the code. Archived to `documents/legacy/plans/stats-charts/plan.md`.

## Context

The `stats` module is an experimental, worker-fed pipeline (SQS → Lambda → `save*` mutations → upserted snapshots). The frontend needs **chart data computed on the fly over a `[from, to]` window** (cap 4 months). No date-range stat exists in the specs or the code. This work adds a **read-only CQRS companion module** (`stats-charts`) that queries the tracking collections directly and computes the charts in memory; the existing `stats` pipeline is untouched.

This plan is an execution artifact and is **never authoritative** (see `documents/plans/README.md`). The authoritative contract is the Spec.

## Decisions (recorded from clarification, 2026-09-23)

All decisions are finalized and distilled into the Spec:

1. `from`/`to` always sent by the frontend; cap `120` days; no server default window.
2. 1RM empty weeks → gap epoch (`best1RM: null`, `participated: false`).
3. Muscle key = `exercise.category`; `RoutineDay.type` only derives the active-plan expected muscles.
4. `routineKcal` always `null` (no calories/duration on `WorkoutSession`); `ExtraSession` uses manual `calories` override else `MET × weightKg × duration/60`; weight from latest `UserWeightLog`, fallback `UserProfile.weightKg`.
5. "Forgotten" expected muscles = active plan (`WeekLog.active`/`DayLog.active` → `RoutineDay.type`), fallback full catalog.
6. No ExtraSession event to the worker.
7. Thresholds = module config constants.
8. One query = one stat + fixed window.

## Goals / Non-Goals

- **Goals:** 6 read-only chart queries; pure in-memory calculators; deterministic ISO-week bucketing in the user timezone; unit coverage per calculator; production-active module that coexists with the `stats` reference models without Mongoose name collisions.
- **Non-Goals (phase boundaries):** **no** schema changes to tracking modules, **no** SQS/persistence/caching, **no** env config, **no** changes under `src/modules/stats/`. Full-repo `npm test` not greened (pre-existing unrelated spec type errors — out of scope).

## Phases & Tasks

### Phase 0 — Spec and planning (this phase, DONE)
- [x] Clarification (8 decisions above).
- [x] `sdd/stats-charts.spec.md` — feature contract (draft).
- [x] `documents/plans/stats-charts/plan.md` — this plan.
- [x] Backlog/index updates (`sdd/README.md`, `documents/plans/README.md`).

### Phase 1 — Module skeleton and shared range utilities (DONE)
- [x] `src/modules/stats-charts/stats-charts.config.ts` — `STATS_CHARTS_MAX_RANGE_DAYS=120`, `STATS_CHARTS_DELOAD_THRESHOLD_PCT=-30`, `STATS_CHARTS_TREND_THRESHOLD_PCT=2`, `STATS_CHARTS_MIN_TREND_WEEKS=3`, `STATS_CHARTS_MIN_SETS_PER_WEEK=2`, `STATS_CHARTS_MAX_1RM_REPS=12`, `STATS_CHARTS_DEFAULT_TIMEZONE`.
- [x] `src/modules/stats-charts/common/range.utils.ts` — window validation (`isValidLocalDate`, `from <= to`, `<= 120 days`, timezone default) and continuous ISO-week key list (`isoweek-Www`, `getISOWeekYear`/`getISOWeek` over `utcToLocalDate`).
- [x] `src/modules/stats-charts/stats-charts.module.ts` — `MongooseModule.forFeature` with **aliased model names + real collection mapping** (`StatsChartsWorkoutSession`→`workoutsessions`, `StatsChartsWeekLog`→`weeklogs`, `StatsChartsDayLog`→`daylogs`, `StatsChartsExtraSession`→`extrasessions`, `StatsChartsExercise`→`exercises`, `StatsChartsUserWeightLog`→`userweightlogs`, `StatsChartsRoutinePlan`→`routineplans`, `StatsChartsRoutineDay`→`routinedays`, `StatsChartsUserProfile`→`userprofiles`); providers added in Phase 3; export of the service.
- [x] `src/modules/stats-charts/presentation/dto/stats-charts.input.ts` — `StatsChartsInput { from, to, timezone? }`.
- [x] `src/app.module.ts` — import `StatsChartsModule`.
- [x] Tests: `common/range.utils.spec.ts` (TEST-001), module boot without model collision (build + targeted jest).

### Phase 2 — Calculators (pure, unit-tested first)
- [x] `one-rm-weekly.calculator.ts` (+ spec) — Epley top-set, eligibility (`reps ∈ [1,12]`, weight `> 0`), weekly gaps. (TEST-002)
- [x] `volume-weekly.calculator.ts` (+ spec) — per-exercise volume, per-muscle sets/volume, `ExtraSession` excluded. (TEST-003)
- [x] `volume-total.calculator.ts` (+ spec) — weekly totals, `deltaPct` null semantics, deload flag. (TEST-004)
- [x] `calories.calculator.ts` (+ spec) — override wins, MET estimation, weight resolution, `estimatedSessions`, `routineKcal: null`. (TEST-005)
- [x] `forgotten-muscles.calculator.ts` (+ spec) — expected muscles plan/catalog, threshold, ordering. (TEST-006)
- [x] `trend.calculator.ts` (+ spec) — least-squares regression, labels, `< 3` weeks → `insufficient`. (TEST-007)

### Phase 3 — Presentation (resolver + outputs)
- [x] `presentation/entities/*.output.ts` — the 6 `ObjectType` chart outputs.
- [x] `stats-charts.service.ts` — facade delegating each query to its calculator.
- [x] `stats-charts.resolver.ts` — 6 queries with `GqlAuthGuard` + `extractUserId`, input mapping, `BadRequestException` on invalid windows.
- [x] Tests: `stats-charts.resolver.spec.ts` (TEST-008).

### Phase 4 — Validation & documentation
- [x] Targeted: `npx jest --config jest.config.js src/modules/stats-charts` (TEST-009) — 8 suites / 73 tests.
- [x] Module gate: `npm run build`, `npm run lint`, targeted jest (TEST-010).
- [x] Verify no diff under `src/modules/stats/` or tracking modules (AC-004).
- [x] Promote Spec `draft → done` after green gate; update `documents/modules/stats-charts.md` (module state) and `sdd/README.md` backlog.
- [x] Archive this plan to `documents/legacy/plans/stats-charts/plan.md` (Historical / Non-Authoritative).

## Execution rules

- One task at a time; tests before implementation; validate each task (Charter §5).
- All identifiers, file paths and enum values must match the Spec exactly.
- If a Spec gap or contradiction appears during implementation: update the Spec first, then this plan, then code (Charter §7).

## Validation commands

```bash
npm run build
npm run lint
npm test
npm run test:e2e
npx jest --config jest.config.js src/modules/stats-charts
```