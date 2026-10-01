# Plan — Stats Charts Performance Test Harness

> **Status:** Active
> **Spec:** `sdd/stats-charts-performance.md`
> **Branch:** `feat/stats-charts-performance`
> **Last updated:** 2026-10-01

Execution artifact. Not authoritative. See the Spec for behavior and `sdd/README.md` for governance. Tasks 1–10 are implemented and validated; `AC-005` (a full manual k6 run against a live API) is still open, so the Spec remains `in_progress` and this Plan is not archived yet.

## Approach

Two independent performance layers, gated off the PR path.

The central decision is **what gets asserted**. Wall-clock time is a property of the machine, not the code, so asserting it on a shared runner produces flaky failures and an eventually-ignored gate. The MongoDB driver, however, reports exactly how many commands were issued and exactly how many documents were returned — integer counts that are reproducible on any machine.

| Metric | Asserted | Why |
|---|---|---|
| `queries` | hard | catches N+1 and duplicated reads; exact integer |
| `docsReturned` | hard | catches missing `select()`/`limit()`; exact integer |
| `elapsedMs` | report only | machine-dependent; `PERF_ENFORCE_TIMING=1` to enforce |
| `roundTrips` | report only | includes cursor batches; informative |

## Tasks

| # | Task | Files | Test | Validate |
|---|---|---|---|---|
| 1 | Spec + Plan | `sdd/`, `documents/plans/` | — | — |
| 2 | Deterministic dataset generator | `test/perf/fixtures/perf-dataset.ts` | `TEST-002` | `jest test/perf` |
| 3 | Driver-level query metrics | `test/perf/metrics/query-metrics.ts` | `TEST-003` | `jest test/perf` |
| 4 | In-memory Mongo + module harness | `test/perf/fixtures/perf-mongoose.ts` | — | `jest test/perf` |
| 5 | Bench + budgets | `test/perf/stats-charts.bench.spec.ts`, `stats-charts.budget.ts` | `TEST-004`, `TEST-005` | `jest test/perf` |
| 6 | Isolated Jest config + scripts | `test/jest-perf.json`, `package.json` | `TEST-001`, `TEST-009` | `jest --listTests` on all three configs |
| 7 | Standalone bulk seed | `scripts/perf/seed-stats-charts.ts` | `TEST-006` | run against in-memory URI |
| 8 | k6 script | `test/load/stats-charts.js` | `TEST-007` | `k6 inspect`, then a real run |
| 9 | Nightly workflow | `.github/workflows/perf.yml` | `TEST-010` | config review |
| 10 | Documentation | `testing.md`, `ci-cd.md`, `modules/stats-charts.md`, `sdd/README.md` | — | — |

Task 6 carries the most risk: a mis-scoped config would let the bench leak into the PR gate. It is verified explicitly by listing collected tests in all three configs.

## Dataset design

One in-memory MongoDB, three sizes, separated by `userId`. Fixed anchor date and a seeded PRNG — no `Math.random()`, no `new Date()` — so two runs produce identical documents and the integer budgets are meaningful (`BR-005`).

| Size | History | Window | Sessions (total / in window) | Extra sessions (total / in window) | Weight logs |
|---|---|---|---|---|---|
| `small` | 28 d | 28 d | 12 / 12 | 4 / 4 | 5 |
| `medium` | 120 d | 120 d | 68 / 68 | 17 / 17 | 18 |
| `large` | 546 d | 120 d | 312 / 68 | 78 / 17 | 79 |

`large` exists for one specific reason: it makes the `BR-007` weight-log escape measurable. Session reads stay bounded by the 120-day window (68 in-window either way), while `getStatsCaloriesWeekly` returns the user's **entire** weight history because `calories.calculator.ts:60-64` filters `loggedAt: { $lte: toUtc }` with no lower bound. `TEST-005` asserts that divergence, turning a code-reading observation into a regression signal.

The seed also creates an active `routineplan` / `weeklog` / `daylog` chain so `forgotten-muscles` exercises the plan-derived path rather than the catalog fallback (`FR-004`); otherwise its two conditional queries never fire and its real cost is never measured.

## Budgets

Measured current values, machine-independent because they are counts. Established by running the bench, recording the output, then writing the table.

Expected `queries`: `volumeTotal` 1, `1RmWeekly` / `volumeWeekly` / `exerciseTrend` 2, `caloriesWeekly` 3, `forgottenMuscles` 6; dashboard 16.

`docsReturned` for `medium`: 98 / 98 / 68 / 36 / 107 / 98, dashboard 505. The `workoutsessions` figure is multiplied by four because four calculators repeat an identical query, and the 30-document exercise catalog is transferred four times unfiltered — the duplication `BR-007` records.

Budgets are the **current** shape, not the target. A spec that ships red teaches the team to ignore it.

## Remediation boundary

This work measures only. The following are documented as the input to a future optimization Spec and explicitly not done here (`BR-001`, `BR-007`):

- four duplicated `workoutsessions` queries across the six calculators
- four unfiltered `exercises.find()` calls, unprojected and unlimited, on a collection with no index that can serve a `find()`
- zero `.select()` across all 18 reads
- `userweightlogs` unbounded below

## Out of scope

- `test/load/auth-smoke.js` — dead, violates `ADR-0001` (uses `Authorization: Bearer`), queries removed operations (`findAll`, `myActiveRoutinePlan`), and holds committed credentials `asd@123.com` / `asd123`. Tracked as a separate cleanup/security task (`BR-006`); this Spec neither repairs nor depends on it.
- `test/load/smoke.js` — left as is, except that it is no longer the only reference for the cookie-extraction pattern.
- `StatsChartsModule` in `test/utils/app-test.module.ts` — the in-process layer builds its own module. The missing stats-charts E2E remains a separate gap.
- Any change under `src/`.

## Validation

Per task: `npx jest --config test/jest-perf.json` for the perf layer.

Final gate: `npm run build`, `npm run lint:ci`, `npm test`, `npm run test:e2e`, plus `npm run test:perf` twice consecutively for flake (`AC-003`).

### Validation log (2026-10-01)

| Item | Result |
|---|---|
| Gate unit/E2E | green — build, `lint:ci` 0 errors, 83 suites / 786 tests, 33 suites / 173 tests |
| `AC-001` | green — 5 suites / 113 tests in ~35 s (`NFR-002` holds) |
| `AC-003` | green — two consecutive passes, no flake |
| `AC-002` | green — one extra `countDocuments` in `volume-total` moved it 1→2 queries and the dashboard 16→17; bench turned red; reverted |
| `AC-004` | green — `--listTests` collects 83 unit / 33 e2e / 5 perf, zero `test/perf` leakage |
| `AC-005` | **pending** — no full manual k6 run against a live API yet |

Two defects were found by the harness itself while validating, both fixed:

1. **`TEST-006` deadlocked.** It spawned the seed with `execFileSync`, which on Windows
   never reaps the child once the same process has already spawned one of its own
   (`mongod`, from `MongoMemoryServer`), and Jest's timeouts cannot interrupt a
   synchronous call. Switched to a promisified async `execFile`: same subprocess, same
   argument parsing, same lifecycle, and it completes in ~24 s.
2. **The seed was not idempotent.** Its `deleteMany({ userId: userIdStr })` filters passed
   the raw string, and because `userId` resolves to `SchemaMixed` no implicit casting
   occurred — the same defect just fixed in the calculators. The deletes matched nothing,
   and the second run collided with its own deterministic `_id`s (`E11000`). Fixed by
   casting with `new Types.ObjectId(userIdStr)` at the delete boundary.
