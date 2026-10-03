# Stats Charts — Performance Test Harness

> **Status:** done
> **Priority:** high

## Context

`stats-charts` (`sdd/stats-charts.spec.md`) ships six read-only `getStats*` queries that compute every chart **in memory** on each request: no `aggregate()` pipeline, no persistence, no streaming, no batching, no `select()`/`limit()` anywhere in the module. Every request reads the tracking collections directly and computes in Node.js, bounded only by `STATS_CHARTS_MAX_RANGE_DAYS = 120`.

The frontend dashboard requests all six charts, so a single screen render multiplies whatever per-query cost exists by six. Nothing in the repository measures that cost:

- `documents/engineering/testing.md` defines exactly two layers (unit, E2E). There is no performance layer, and no guidance on time-based assertions.
- No Spec carries a performance NFR (`stats-charts.spec.md` `NFR-001`..`NFR-006` are about read-only safety, config constants, determinism, language, mock patterns and gate scoping).
- `.github/workflows/ci.yml` has no perf step and no perf gate.
- `package.json` has no perf script and no perf dependency.
- `test/load/` holds two **orphaned and stale** k6 scripts: no npm script, no CI step, no documentation references either file. `smoke.js` only exercises `exercises`/`routinePlans`, never a chart query. `auth-smoke.js` is broken against the current auth contract (`Authorization: Bearer` violates `ADR-0001-jwt-http-only-cookie`; it queries the removed `findAll` / `myActiveRoutinePlan`) and carries hard-coded credentials committed to the repository. `auth-smoke.js` cleanup is tracked separately as a security task and is **out of scope here**.

Two further blocks make the module unmeasurable today: `StatsChartsModule` is not registered in `test/utils/app-test.module.ts`, so there is no E2E path into the module; and there is no bulk fixture builder, so a realistic dataset would have to be created through serial GraphQL mutations, one week per round trip.

**This Spec adds a performance test layer for `stats-charts` only.** It measures and budgets the current behavior. It changes no query, no calculator and no contract.

### Decisions (clarification)

| Topic | Decision |
|---|---|
| Scope | `stats-charts` only. A cross-cutting API performance layer is a later concern. |
| Two layers | (1) in-process bench over the six calculators against real MongoDB (`mongodb-memory-server` + `StatsChartsModule`, `.lean()` real so documents are genuinely materialized); (2) k6 end-to-end against `POST /graphql`. Layer 1 catches query-shape and algorithm regressions; layer 2 catches GraphQL, guard, serialization and concurrency. |
| Asserted metric | `queries` (Mongo commands per call, excluding `getMore`/`killCursors`) and `docsReturned` (Σ `reply.nReturned`) — both **exact integers**, machine-independent, zero flake. |
| Reported metric | `elapsedMs` (median of N iterations after warmup) and `roundTrips` (all commands). Reported only; enforced solely when `PERF_ENFORCE_TIMING=1`. |
| Budget policy | Budgets are the **measured current values**, i.e. a characterization lock. Adding a `select()`, an `aggregate()` or a shared repository turns the bench red and forces a deliberate decision. Budgets are **not** the desired values: a spec that ships red is worse than one that locks reality. |
| Timing is never budgeted | Wall-clock on a shared CI runner is noise. k6 thresholds are loose sanity checks; real numbers come from `--summary-export` for manual comparison against the stored baseline. |
| Gate | Nightly (`schedule`) + `workflow_dispatch` only. **Never on `pull_request`.** The PR gate stays exactly `build` → `lint:ci` → `test` → `test:e2e`. |
| Dataset | Bulk seed via `insertMany` over the aliased `StatsChartsModule` models + `Model.init()` (real schema indexes, schema-valid docs, no hydration). Deterministic PRNG, fixed anchor date, no `Math.random()` and no `new Date()`, so two runs are byte-comparable. |
| Authenticated identity | The seeded user's `_id` is **pinned** to the dataset's `userId`, and the k6 script asserts that the charts actually return the seeded data (`checks: ['rate>0.99']`). A run that measures an empty database is not a measurement: `login` puts `user._id` in the JWT, the calculators query by that id, and a user that owns nothing answers `[]` with HTTP 200 and no GraphQL error. |
| Isolation | Three dataset sizes share **one** in-memory MongoDB, separated by `userId`. |
| Storage | `test/perf/` with its own `test/jest-perf.json`, so neither `jest.config.js` (`rootDir: src`) nor `test/jest-e2e.json` can collect it. |
| Credentials | Perf user credentials come from environment variables. No credential is committed (the `auth-smoke.js` anti-pattern is not repeated). |
| Remediation | Out of scope. The measured hotspots become a separate optimization Spec. |

## Requirements

### Functional Requirements

- `FR-001` — A performance suite lives at `test/perf/` with its own Jest config `test/jest-perf.json` (`testRegex: "test/perf/.*\\.spec\\.ts$"`, `maxWorkers: 1`, `--runInBand` semantics for the shared in-memory server). It is **not** collectable by `npm test` (`jest.config.js`, `rootDir: 'src'`) nor by `npm run test:e2e` (`test/jest-e2e.json`).
- `FR-002` — A deterministic dataset generator `test/perf/fixtures/perf-dataset.ts` builds, from a fixed anchor date and a seeded PRNG: `exercises` (30), `workoutsessions`, `extrasessions`, `userweightlogs`, `userprofiles`, plus an active `routineplan` (6 non-rest `routinedays` + 1 rest) with an active `weeklog` (`planId`) and an active `daylog` (`routineDayId` inside the plan). It exposes the generated counts and the window so the budgets can be asserted against them.
- `FR-003` — Three sizes, each with a **fixed** `windowDays` and a **variable** `historyDays`:
  - `small` — history 28 d, window 28 d, 12 sessions, 4 extra sessions.
  - `medium` — history 120 d, window 120 d, 68 sessions, 17 extra sessions.
  - `large` — history 546 d, window 120 d, 312 sessions, 78 extra sessions (only 68 / 17 land inside the window).
  
  `windowDays` is the legal maximum for `medium` and `large`; `large` exists specifically to show that session queries stay bounded by the window while `getStatsCaloriesWeekly` does not.
- `FR-004` — The generator must produce the `forgotten-muscles` **active-plan** path, not the catalog fallback: the active `weeklog.planId` and the active `daylog.routineDayId` must resolve to `routinedays`, so the conditional `routineplans` and `routinedays` queries both execute and the expected-muscle union comes from the plan. Otherwise that query's cost is not measured.
- `FR-005` — A query metrics collector `test/perf/metrics/query-metrics.ts` subscribes to the MongoDB driver's `commandStarted` / `commandSucceeded` events on the Mongoose connection and reports, for a measured window: `queries` (commands excluding `getMore`/`killCursors`), `roundTrips` (all commands), and `docsReturned` (the number of documents materialized, summed across cursor batches). It must expose `start()` / `stop()` so seeding and warmup are excluded from the measurement.
  - **Driver detail (corrects an earlier draft of this Spec):** `docsReturned` reads `reply.nReturned` when the driver populates it, and falls back to `reply.cursor.firstBatch.length` when it does not. MongoDB driver 6.x no longer populates `nReturned` on `find` command replies, so a collector that read `nReturned` alone would report `0` documents for every measured read; reading the cursor batch is what makes the metric meaningful. Both paths are implemented and both are covered by `TEST-003`, because either can appear depending on the command. `getMore` is counted in `roundTrips` but contributes no `docsReturned`, which is correct here because every measured read is bounded well below the 101-document default batch size.
- `FR-006` — `test/perf/stats-charts.bench.spec.ts` measures all six calculators for all three sizes against a real MongoDB and asserts `queries` and `docsReturned` against a budget table declared in `test/perf/stats-charts.budget.ts`. It also reports a `dashboard` aggregate (the six queries executed together, the real frontend pattern) and `elapsedMs` per calculator.
- `FR-007` — Budget table: exact integers, established from a measured baseline. Because they are counts and not durations, they hold on any machine. Expected `queries`: `getStatsVolumeTotalWeekly` 1, `getStats1RmWeekly` / `getStatsVolumeWeekly` / `getStatsExerciseTrend` 2 each, `getStatsCaloriesWeekly` 3, `getStatsForgottenMuscles` 6; dashboard 16.
- `FR-008` — A standalone bulk seed `scripts/perf/seed-stats-charts.ts` for the k6 layer: connects to `--uri`, creates (or reuses) the perf user with a bcrypt password from `PERF_USER_PASSWORD`, and writes the dataset for `--size`. It deletes **only** the previous data of that perf user (never the whole database), so it is safe against a dedicated performance database. `PERF_USER_EMAIL` and `PERF_USER_PASSWORD` are **required with no default**: the script exits non-zero with a clear message when either is missing, because a committed fallback password would be a leak the moment the script is pointed at a non-throwaway database (`NFR-006`). The created user is created with an explicit `_id` equal to the dataset's `userId`, never left to Mongo: the dataset's documents are owned by that id, and `login` authenticates by `user._id`, so a random `_id` would hand every chart a user that owns nothing. See "Relationship to the authenticated perf user" below.
- `FR-009` — A k6 script `test/load/stats-charts.js` with seven scenarios: one per chart query plus `dashboard` (all six in a **single** GraphQL request, the worst case: Apollo resolves sibling query fields in parallel, so six concurrent Mongo reads compete for the connection pool). Authentication uses the HttpOnly cookie, extracting `token=` from `set-cookie` exactly as `test/load/smoke.js` does (`ADR-0001`). Credentials come from `__ENV`. Every scenario additionally checks that the response carries the seeded data, so a run against a mis-authenticated or unseeded database fails loudly instead of reporting a fast, meaningless result.
- `FR-010` — k6 thresholds are loose sanity checks only: `http_req_duration: p(95) < 2000` and `http_req_failed: rate < 0.01`. A third, `checks: rate > 0.99`, is the one that can fail for a correctness reason rather than a performance one, and it exists because without a `checks` threshold even a failing `check()` leaves the run green. Real figures are exported to `test/perf/results/k6-summary.json` via `--summary-export`, wired into the `test:perf:k6` npm script so the export cannot be forgotten; the output directory is git-ignored. The target endpoint comes from `__ENV.BASE_URL` (default `http://localhost:3000/graphql`) and every k6 option is overridable with `-e`.
- `FR-011` — npm scripts: `test:perf` (in-process bench), `test:perf:k6` (k6), `perf:seed` (standalone seed). `package.json` gains no dependency: k6 is an external binary, and the in-process layer uses the already-present `mongodb-memory-server`.
- `FR-012` — `.github/workflows/perf.yml` runs on `schedule` + `workflow_dispatch` and asserts **only** the deterministic budgets. Timing is printed for manual comparison and never fails the job.

### Business Rules

- `BR-001` — The performance layer **never** changes application behavior. No query, calculator, resolver, schema, index, threshold constant or tracking module is modified. A red bench is resolved by making a deliberate, Spec'd change — never by relaxing the budget silently.
- `BR-002` — Hard assertions are permitted only on `queries` and `docsReturned`. Any assertion on wall-clock time requires `PERF_ENFORCE_TIMING=1` and is off by default, because timing on shared runners is not a property of the code.
- `BR-003` — The performance layer is excluded from coverage (`test/perf/` is not under `src/`, and `test/jest-e2e.json` collects only `src/**`). It must not move the combined coverage baseline.
- `BR-004` — The PR gate is unchanged. `npm run build`, `npm run lint:ci`, `npm test` and `npm run test:e2e` must behave exactly as before this Spec, and `npm test` / `npm run test:e2e` must not collect a single file from `test/perf/`.
- `BR-005` — Datasets are reproducible: fixed anchor date, seeded PRNG, no `Math.random()`, no `new Date()` in the generator. Two runs on the same size must produce identical document sets, otherwise the integer budgets are meaningless.
- `BR-006` — `test/load/auth-smoke.js` is **not** repaired by this Spec. It is dead, violates `ADR-0001` and holds committed credentials; its removal is a separate cleanup/security task. This Spec must not depend on it.
- `BR-007` — Measured hotspots are recorded, not fixed. Specifically: four of six calculators repeat an identical `workoutsessions` query; four of six repeat an unfiltered, unprojected, unlimited `exercises.find()` (and `exercises` has no index that can serve a `find()`); no read uses `.select()`; and `getStatsCaloriesWeekly` loads the user's entire `userweightlogs` history (`loggedAt: { $lte: toUtc }`, no lower bound) — the one query not bounded by `STATS_CHARTS_MAX_RANGE_DAYS`.

### Non-Functional Requirements

- `NFR-001` — **No flake.** Re-running `npm run test:perf` unchanged must pass. This is guaranteed structurally: the asserted metrics are exact counts, the dataset is deterministic, and timing is excluded by default (`BR-002`).
- `NFR-002` — **Fast enough to be run on demand.** The whole in-process layer completes in under 60 s on a developer machine, so it is usable in the inner loop and not only in CI.
- `NFR-003` — **English artifacts.** Spec, Plan, test names, comments and output labels in English (Charter §8).
- `NFR-004` — **Test-first.** Every new module has its own test before its implementation, following Charter §4 and `documents/engineering/testing.md` §9.
- `NFR-005` — **No new runtime dependency and no env var for thresholds.** Perf thresholds live in `test/perf/stats-charts.budget.ts`, mirroring the `stats-charts` rule that tuning constants are module-level constants, not env vars.
- `NFR-006` — **No committed secret.** The perf user email/password are read from `PERF_USER_EMAIL` / `PERF_USER_PASSWORD`; a committed default credential is a defect, not a convenience.
- `NFR-007` — **Read-only toward production data.** The seed only ever writes the perf user's documents, and its default target is a dedicated performance database. It must never be pointed at a production URI as part of the documented workflow.

## Constraints

- Do **not** modify any calculator, the service, the resolver, the module registration, any tracking schema, or `src/modules/stats/`.
- Do **not** add `.select()`, `.limit()`, `aggregate()` pipelines, caching, a repository layer, dataloaders or a lower bound on `userweightlogs`. Those are the optimization Spec, not this one.
- Do **not** add a timing assertion that runs by default.
- Do **not** add `test/perf` to `jest.config.js`, to `test/jest-e2e.json`, or to the `test:e2e` glob.
- Do **not** add a `pull_request` trigger or any step to `.github/workflows/ci.yml`.
- Do **not** add a dependency to `package.json`. k6 is external; the in-process layer reuses `mongodb-memory-server` and `supertest`-free direct calculator calls.
- Do **not** commit a credential, a perf result file, or a modified `test/load/auth-smoke.js`.
- Do **not** register `StatsChartsModule` in `test/utils/app-test.module.ts`; the in-process layer builds its own module.

## Architecture

```
test/perf/
  stats-charts.bench.spec.ts     FR-006  6 calculators x 3 sizes, real Mongo
  stats-charts.budget.ts         FR-007  exact integer budgets
  perf-artifacts.spec.ts         FR-001  suite isolation, k6 + workflow contract
  seed-idempotency.spec.ts       FR-008  seed runs twice, touches only its own user
  metrics/query-metrics.ts       FR-005  commandStarted/Succeeded collector
  fixtures/perf-dataset.ts       FR-002  deterministic generator
  fixtures/perf-mongoose.ts      FR-001  in-memory Mongo + StatsChartsModule
  results/                       FR-010  git-ignored outputs
test/load/stats-charts.js        FR-009  k6: 6 scenarios + dashboard
scripts/perf/seed-stats-charts.ts FR-008 standalone bulk seed for k6
.github/workflows/perf.yml       FR-012  schedule + dispatch, budgets only
```

The two layers are deliberately independent:

```
k6 layer                         in-process layer
POST /graphql                    calculator.execute()
 └ GqlAuthGuard (JWT cookie)        └ range/utils validation is NOT reached
 └ GraphQL parse/serialize       └ 6 Mongoose reads (.lean(), real)
 └ 6 calculators                └ commandStarted/Succeeded collector
 └ MongoDB                       └ exact integer budgets
```

Why the in-process layer is not redundant with k6: it is the only one that can assert an **exact** query count. k6 on a shared runner can tell you the request got slower; it cannot tell you that a sixth `exercises.find()` was added without a large, stable, deterministic dataset and a query counter. `queries` and `docsReturned` are properties of the code; `elapsedMs` is a property of the machine.

Metric semantics, all from the driver rather than from Mongoose internals:

| Metric | Source | Meaning |
|---|---|---|
| `queries` | `commandStarted` minus `getMore`/`killCursors` | how many queries the code issued — catches N+1 and duplicated reads |
| `roundTrips` | all `commandStarted` | real network round trips, including cursor batches |
| `docsReturned` | Σ `reply.cursor.firstBatch.length` | documents materialized into Node memory — catches missing `select()`/`limit()` |
| `elapsedMs` | `performance.now()` | wall clock, median after warmup, report only |

## Files

- `sdd/stats-charts-performance.spec.md` (new — this Spec, authored as `stats-charts-performance.md` and promoted to `.spec.md` on reaching `done`)
- `documents/legacy/plans/stats-charts-performance/plan.md` (new — implementation Plan, authored under `documents/plans/` and archived as Historical on completion)
- `test/jest-perf.json` (new — isolated Jest config)
- `test/perf/stats-charts.bench.spec.ts` (new — `TEST-004`, `TEST-005`)
- `test/perf/k6-queries.spec.ts` (new — `TEST-011`, the k6 documents against the real schema)
- `test/perf/stats-charts.budget.ts` (new — integer budgets, `FR-007`)
- `test/perf/perf-artifacts.spec.ts` (new — `TEST-001`, `TEST-007`, `TEST-010`, plus the `FR-011` npm-script contract)
- `test/perf/seed-idempotency.spec.ts` (new — `TEST-006`)
- `test/perf/metrics/query-metrics.ts` (new — driver-level collector)
- `test/perf/metrics/query-metrics.spec.ts` (new — `TEST-003`)
- `test/perf/fixtures/perf-dataset.ts` (new — deterministic generator)
- `test/perf/fixtures/perf-dataset.spec.ts` (new — `TEST-002`)
- `test/perf/fixtures/perf-mongoose.ts` (new — in-memory harness)
- `test/load/stats-charts.js` (new — k6, 7 scenarios)
- `scripts/perf/seed-stats-charts.ts` (new — standalone bulk seed)
- `.github/workflows/perf.yml` (new — nightly + dispatch)
- `package.json` (modify: `test:perf`, `test:perf:k6`, `perf:seed`; no dependency)
- `.gitignore` (modify: `/test/perf/results`)
- `documents/engineering/testing.md` (modify: third layer + commands, after validation)
- `documents/engineering/ci-cd.md` (modify: nightly workflow, after validation)
- `documents/modules/stats-charts.md` (modify: performance section, after validation)
- `sdd/README.md` (modify: Backlog row)

## Tests

- `TEST-001` — Suite isolation: assert that `jest.config.js` (`rootDir: 'src'`) and `test/jest-e2e.json` (`testRegex: "test/e2e/.*\\.spec\\.ts$"`) collect **zero** files from `test/perf/`, while `test/jest-perf.json` collects them. Proves `FR-001`, `BR-004`.
- `TEST-002` — `perf-dataset.spec.ts`: for each size, the generator returns the declared counts, the same seed produces identical documents across two calls (`BR-005`), the window is a valid `StatsChartsInput` window (`from <= to`, span `<= 120`), every `workoutsession` in the window is `status: 'complete'` / `deleted !== true`, and the active-plan path resolves (a `weeklog` with `planId` and a `daylog` with a `routineDayId` contained in that plan). Proves `FR-002`, `FR-003`, `FR-004`.
- `TEST-003` — `query-metrics.spec.ts`: against a fake client emitter, `start()`/`stop()` bracket only the measured window, `getMore` and `killCursors` are excluded from `queries` but included in `roundTrips`, `docsReturned` sums the per-command document count across several `commandSucceeded` events (cursor batches) from **both** `reply.nReturned` and the `reply.cursor.firstBatch` fallback, and a command with neither contributes `0`. Proves `FR-005`.
- `TEST-004` — `stats-charts.bench.spec.ts`: for each of the three sizes, the six calculators plus the dashboard aggregate are measured against real MongoDB and asserted against `test/perf/stats-charts.budget.ts` on `queries` and `docsReturned`. Reports `elapsedMs` / `roundTrips` and writes `test/perf/results/in-process.json`. Proves `FR-006`, `FR-007`.
- `TEST-005` — `getStatsCaloriesWeekly` is the only query whose cost grows with history length rather than window length: `docsReturned` for `large` strictly exceeds `medium` while `getStatsVolumeTotalWeekly` is identical for both. Records `BR-007` as a measured, documented characteristic.
- `TEST-006` — `seed-stats-charts.ts` run twice against a throwaway URI is idempotent: the second run leaves the same document counts, and no document outside the perf user's id is touched. Additionally, the created user document's `_id` **is** the dataset's `userId`, and every seeded collection has documents owned by it — an identity mismatch is what makes a k6 run measure an empty database while reporting green. Proves `FR-008`, `NFR-007`.
- `TEST-007` — k6 script contract: parses with `k6 inspect` and the seven scenarios plus the thresholds are present; the script reads credentials from `__ENV` and contains no literal password; and it declares both the per-scenario data check and the `checks` threshold that makes an empty response fail the run. A companion assertion covers the **seed** script for the credential rule, since it is the component that actually writes a bcrypt login. A missing `k6` binary skips only the inspect-based assertion — a script k6 refuses to parse must fail the test, since treating any failure as a skip would make a broken script green. Proves `FR-009`, `FR-010`, `NFR-006`.
- `TEST-008` — `npm run test:perf` green and re-runnable (twice in a row) with no timing assertion active. Proves `NFR-001`, `NFR-002`, `BR-002`.
- `TEST-009` — Regression gate: `npm run build`, `npm run lint:ci`, `npm test`, `npm run test:e2e` unchanged, and `npm test` / `npm run test:e2e` collect no `test/perf` file. Proves `BR-004`, `AC-004`.
- `TEST-010` — `.github/workflows/perf.yml` declares `schedule` and `workflow_dispatch` and **no** `pull_request` / `push`; `.github/workflows/ci.yml` is byte-identical to its pre-Spec content. Proves `FR-012`, `BR-004`.
- `TEST-011` — every query document the k6 script can send validates against the schema the application actually serves: the real schema is built from the real `StatsChartsResolver` with `GraphQLSchemaFactory`, the seven documents are extracted from the script and run through `graphql`'s `parse` + `validate`, and a second assertion confirms each chart query selects one field while the dashboard selects all six. Proves `FR-009`, `FR-011`. Added after the first live run failed — see "Relationship to the k6 query documents".

## Acceptance Criteria

- `AC-001` — `npm run test:perf` runs the six calculators across three dataset sizes and passes, asserting exact `queries` / `docsReturned` against the budget table, with a measured baseline written to `test/perf/results/in-process.json`.
- `AC-002` — A query-shape change in any calculator turns the bench red. Verified negatively during validation by temporarily adding one extra read and observing the failure, then reverting.
- `AC-003` — `npm run test:perf` passes twice in a row with no timing assertion enabled.
- `AC-004` — The canonical PR gate is untouched: `npm run build`, `npm run lint:ci`, `npm test`, `npm run test:e2e` behave exactly as before, and neither collects a `test/perf` file.
- `AC-005` — `npm run perf:seed` plus `npm run test:perf:k6` measures all six queries and the dashboard aggregate end-to-end against a real `POST /graphql`, exporting a summary to `test/perf/results/`. A green run additionally proves the data check passed: the charts answered with the seeded documents, so the timings describe real calculations rather than empty responses. Met on 2026-10-02: 215 requests over 30 s at 1 iteration/s per scenario, `http_req_failed` 0.00%, 643 checks passed and 0 failed, `http_req_duration` avg 112 ms / med 110 ms / p95 158 ms / max 245 ms, summary exported, no threshold crossed. `TEST-011` proved the documents themselves are valid against the served schema.
- `AC-006` — `.github/workflows/perf.yml` runs on a schedule and on demand, asserts only the deterministic budgets, and is never triggered by a pull request. `.github/workflows/ci.yml` is unchanged.
- `AC-007` — No application file is modified **by this Spec**: no calculator, service, resolver, schema or module. The diff of this Spec touches only `test/`, `scripts/perf/`, `.github/workflows/perf.yml`, `package.json` scripts, `.gitignore` and documentation. `BR-001` and `BR-007` hold. The one exception is the merge of `feat/mongo-connection-config`, which enters this branch as a delivered change of its own Spec (`sdd/mongo-connection-config.spec.md`) rather than as an edit authored here — see "Relationship to the configurable connection".
- `AC-008` — The four measured hotspots of `BR-007` and the `medium` vs `large` divergence of `TEST-005` are documented in `documents/modules/stats-charts.md` as the input to a future optimization Spec, with no remediation in this one.
- `AC-009` — The `ObjectId`-casting defect that blocked this Spec is delivered as its **own** change, tracked in `sdd/stats-charts.spec.md`, and is therefore outside `AC-007`'s diff. See "Relationship to the ObjectId fix" below.

## Relationship to the ObjectId fix

Building this Spec surfaced a **correctness defect**, not a performance one: all six
`stats-charts` calculators passed the raw string `userId` from `extractUserId()` straight
into Mongoose queries (`userId: userId as any`). Because `userId` resolves to `SchemaMixed`
in the compiled schemas, no implicit casting occurs, so those filters matched **zero**
documents against real data. `oneRmWeekly` and `exerciseTrend` returned `[]` and the rest
returned hollow skeletons.

That violates `ADR-0003` and `coding-standards.md` §"Never assume Mongoose casts strings to
ObjectId", whose reference implementation is
`src/modules/routines/tracking/week-log/infrastructure/repositories/week-log.repository.ts`.

**Resolution of the Spec/Code contradiction:** the defect was **not** fixed inside this
Spec, because `BR-001` and the Constraints forbid touching calculators, and because
optimizing queries is explicitly a different Spec. It was fixed as a separate, independently
delivered change — 10 query sites across the 6 calculators cast explicitly with
`new Types.ObjectId(userId)`, and their unit specs were hardened from
`expect(userId.toString()).toBe(...)` to also assert `toBeInstanceOf(Types.ObjectId)`, since
the old assertion passed for both a string and an ObjectId and so could never catch it.

Two consequences for this Spec:

1. **`AC-007` is scoped to this Spec's own diff.** The application change belongs to the
   `stats-charts` Spec, not here, and no performance behavior was altered by it.
2. **The `FR-007` budgets are a post-fix baseline.** They describe the calculators *after*
   the cast correction. Had they been frozen from the defective state, they would have
   encoded `docsReturned: 0` as the expected behavior. The budget table's values are
   therefore asserted against real, non-empty data — see `TEST-005` and `AC-008`.

## Relationship to the authenticated perf user

The same identity defect, in the seed rather than in the calculators, would have made the
k6 layer meaningless. The seed created its login user with `UserModel.create({ ... })` and
no `_id`, so Mongo assigned a random one on every run, while the dataset's documents are
owned by the deterministic `stableObjectId('user:' + size)`. Since `login` puts
`user._id` in the JWT payload (`sub`), the guard resolves that document and
`extractUserId()` hands its `_id` to every calculator, the k6 session authenticated as a
user that owned none of the seeded data.

Every chart would have answered `[]` — HTTP 200, no GraphQL error — and the run would have
reported green while timing an empty database. The k6 script did not catch it either:
`checkOk` asserted only status and absence of `errors`, and with no `checks` threshold even
a failing `check()` left the run green.

Resolved as a change to this Spec (`FR-008`, `FR-009`, `FR-010`, `TEST-006`, `TEST-007`),
delivered with the tests that would have caught it:

1. The seed pins the user's `_id` to the dataset's `userId`, so the authenticated
   identity and the data owner are the same id by construction.
2. `TEST-006` asserts that equality directly, and that every seeded collection has
   documents owned by it.
3. Every k6 scenario checks that the response carries the seeded data, and
   `checks: ['rate>0.99']` turns a failed check into a failed run.

Nothing in the in-process layer is affected: it builds its own module and never
authenticates, so the `FR-007` budgets are unchanged. This is the same root cause as the
ObjectId fix above — an id that is not what the code assumes it is — arriving from the
other end of the stack.

## Relationship to the configurable connection

`AC-005` needs a live API pointed at a database that belongs to the perf run and to
nothing else, so that the measured timings cannot be perturbed by — and cannot leak into —
shared data. On this branch `src/app.module.ts` hardcoded the Atlas connection string, so
there was no way to aim the API anywhere without editing an application file, which `AC-007`
forbids. The contradiction is real and it is resolved here rather than silently:

the connection became configurable in its own Spec, `sdd/mongo-connection-config.spec.md`
(`MONGO_URL` with the previous URI as the byte-identical default, plus an isolated
`docker-compose.yml`), and that branch is merged into this one. `AC-007` therefore has one
declared exception, exactly as `AC-009` does for the ObjectId fix, and the reason is the
same: a change with its own contract is delivered by its own change and then depended upon,
rather than smuggled into a Spec whose diff is deliberately narrow.

The merge is inert for the measured numbers. `buildMongoUri()` decides only *where* the
connection points; with `MONGO_URL` unset it returns the URI that was hardcoded before, so
a run that sets no variable reaches exactly the same database this branch always did. Only
a run that sets the variable changes target, and it does so to the throwaway container.

One ordering rule follows from it, and it is what makes `AC-005` reproducible: the seed runs
**before** the API boots. `scripts/perf/seed-stats-charts.ts` builds its own module from
`StatsChartsModule` and never imports `AppModule`, so the autoseed does not run inside it —
but the API process that serves the k6 requests does boot `SeedModule`. Booting that API
into an empty database first would let the autoseed claim the exercise catalog under
Mongo-generated `_id`s, and the seed's upsert-by-`_id` would then collide with the unique
`name` index. Seeded first, every autoseed step finds data and skips.

The second autoseed step is worth naming because it did **not** skip: the plan is looked up by
name (`PPL 6 días — Principiante/Intermedio`), the dataset's plan is called `Perf PPL 6 días`, so
the API created a second plan. It cannot affect the measurement — neither plan is referenced by
the perf user's weeklog or daylog (`routinePlanId` is unset on both), so the stats queries never
resolve through `routineplans` for this dataset — but a run that compares `readBack.routinePlans`
before and after a live boot will see `1` become `2`.

## Relationship to the k6 query documents

The first live k6 run failed 6 of its 7 scenarios with `GRAPHQL_VALIDATION_FAILED`, and the cause
was that the script's query documents had never been checked against the schema the application
serves. They were written against an assumed shape: `getStats1RmWeekly` asked for `exerciseName`,
`weekKey` and `best1RM` directly on `Exercise1RmWeekly`, which exposes `exerciseId`, `name`,
`category` and a nested `weeks` list; `MuscleVolume` has `muscle` and `volume`, not `category` and
`volumeKg`; `VolumeTotalWeeklyEntry` has `totalVolume`, not `totalVolumeKg`; `ExerciseTrend` has
`label`, `slope`, `pctChange` and `weeksUsed`, not `current1RM` / `previous1RM` / `trend`. Only
`getStatsCaloriesWeekly` was spelled correctly, which is exactly why one scenario passed and six
did not.

Three layers had passed while this was true. The in-process bench calls the calculators directly
and never crosses GraphQL. `TEST-007` runs `k6 inspect`, which proves the *JavaScript* is well
formed — `graphql.parse` stops at the document's own syntax and never compares a field name
against a type. And the run still produced numbers: `http_req_duration` med 15 ms with no request
erroring, because a validation failure is a perfectly fast response. Only the `checks` threshold
added for the identity defect stopped it being read as a pass.

The fix is the documents, plus `TEST-011`, which closes the gap rather than the symptom: it builds
the real schema from the real resolver and validates all seven documents, so renaming a field in a
presentation entity turns the perf suite red instead of the next live run. It lives in `test/perf/`
rather than beside the schema spec so that `AC-007`'s narrow diff still holds.
