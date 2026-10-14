# Plan — Stats Charts Performance Test Harness

> **Status:** Historical / Non-Authoritative
> **Spec:** `sdd/stats-charts-performance.spec.md`
> **Executed on branch:** `feat/stats-charts-performance`
> **Last updated:** 2026-10-02

Execution artifact. Not authoritative. See the Spec for behavior and `sdd/README.md` for governance. Tasks 1–10 are implemented and validated, `AC-005` closed by a full manual k6 run on 2026-10-02, and every acceptance criterion passes. The authoritative contract is `sdd/stats-charts-performance.spec.md`. This plan is kept for traceability and historical review only.

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
| Spec amendment | green — the seed/user-identity defect below was resolved as a Spec change (`FR-008`, `FR-009`, `FR-010`, `TEST-006`, `TEST-007`) before the k6 run, not as a silent code fix |

### Validation log (2026-10-02, closing `AC-005`)

The isolated Mongo (`docker compose up -d`) was seeded for `medium`, an API was booted against it
with `MONGO_URL`, and `npm run test:perf:k6` was run with `PERF_WINDOW_DAYS=120` to match the
dataset's own window (`medium` spans 120 days; the script's default of 28 would have measured a
slice that the `FR-007` budgets do not describe).

| Item | Result |
|---|---|
| `AC-005` | **green** — 215 requests, 7 scenarios × 30 s at 1 iteration/s; `http_req_failed` 0.00%; **643 checks passed, 0 failed**; `http_req_duration` avg 112 ms / med 110 ms / p95 158 ms / max 245 ms; summary exported to `test/perf/results/k6-summary.json`; no threshold crossed |
| `AC-006` | green — `perf.yml` declares only `schedule` (`0 3 * * 1-5`) and `workflow_dispatch`, runs only the deterministic in-process budgets, and `TEST-010` confirms `ci.yml` is byte-identical |
| `AC-007` | green with one declared exception — the diff touches `test/`, `scripts/perf/`, the workflow, `package.json`, `.gitignore` and docs; the only application change present is the merge of `feat/mongo-connection-config`, delivered by its own promoted Spec |
| `AC-008` | green — the four hotspots and the `medium` vs `large` divergence are in `documents/modules/stats-charts.md`, "Measured performance baseline" |
| `AC-009` | green — the ObjectId correction is recorded in `sdd/stats-charts.spec.md` |
| `TEST-011` | green — all seven k6 query documents validate against the schema built from the real `StatsChartsResolver` |
| Perf suite | green — 6 suites / 124 tests |
| Full gate | green — `build`, `lint:ci` 0 errors, `npm test`, `npm run test:e2e` |

The first live run **failed** 6 of 7 scenarios and exposed a fourth defect, the most direct one yet:

4. **The k6 query documents did not match the served schema.** Six of the seven documents were
   written against an assumed field shape (`exerciseName`, `totalVolumeKg`, `volumeKg`,
   `current1RM` / `trend`, `lastTrainedDate`) that the code-first entities do not expose, so every
   request but `getStatsCaloriesWeekly` returned HTTP 400 with `GRAPHQL_VALIDATION_FAILED`. Three
   layers had passed over it: the in-process bench never crosses GraphQL, `k6 inspect` only proves
   the JavaScript parses, and a validation failure is still a fast response — `med 15 ms`, zero
   failed requests. Only the `checks` threshold caught it. Fixed by correcting the documents against
   the real entities plus `TEST-011`, which validates all seven against the real schema so the next
   field rename fails the suite rather than the next live run. See the Spec section "Relationship to
   the k6 query documents".

The same run also settled two operational facts, both recorded rather than assumed: the API's
autoseed creates a second `routineplans` document because the plan is matched by name and the
dataset's is called differently, and neither plan is referenced by the perf user's weeklog or
daylog, so it cannot influence the six queries.

Three defects were found by the harness itself while validating, all fixed:

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
3. **The seed's login user owned nothing.** Found while preparing `AC-005`, and the most
   dangerous of the three: the seed created its user without an `_id`, so Mongo assigned a
   random one, while the dataset's documents belong to `stableObjectId('user:' + size)`.
   Since `login` puts `user._id` in the JWT and the calculators query by that id, a k6 run
   would have authenticated as a user with no data — every chart answering `[]` with HTTP
   200 and no GraphQL error, and the run reporting green. The k6 script could not catch it:
   `checkOk` asserted only status and error-freedom, and with no `checks` threshold even a
   failing `check()` left the run green. Fixed by pinning the seeded user's `_id` to the
   dataset's `userId`, checking the seeded data in every scenario, and adding
   `checks: ['rate>0.99']`; `TEST-006` and `TEST-007` now assert both. See the Spec section
   "Relationship to the authenticated perf user".
