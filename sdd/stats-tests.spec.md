# Stats Pure Use-Case Unit Tests

> **Status:** done
> **Priority:** low

## Context

The `stats` module (`src/modules/stats/`) is **experimental**: it has a hexagonal architecture (9 use cases in `application/use-cases/`, domain entities and repository interface, Mongoose infrastructure, presentation DTOs/entities), it is registered in `app.module.ts`, but it is **not active in production**. By decision it stays outside the stats production activation gate; before this Spec the module had **0% coverage** (no suites existed). See `documents/modules/stats.md`.

This Spec adds unit tests for the **pure use cases** — the ones that can be tested without touching production behavior: the four `save-*` use cases and `get-raw-data-for-worker`. It adopts the mock patterns documented in `documents/engineering/testing.md` (section 6), keeping the tests outside the stats production activation decision.

## Requirements

### Functional Requirements

- `FR-001` — Unit test `SaveTopExercisesUseCase`: given `userId`, `exercises[]` entries and `computedAt`, it maps input to `UserTopExerciseDomain`/`TopExerciseEntryDomain` and calls `statsRepository.upsertTopExercises(userId, domain)` with the expected arguments.
- `FR-002` — Unit test `SaveTopRoutinesUseCase`: same contract for the top-routines domain mapping and `statsRepository.upsertTopRoutines`.
- `FR-003` — Unit test `SavePersonalRecordsUseCase`: maps `personalRecords[]` into the personal-records domain and calls `statsRepository.upsertPersonalRecords`.
- `FR-004` — Unit test `SaveAdherenceUseCase`: maps adherence data into the adherence domain and calls `statsRepository.upsertAdherence`.
- `FR-005` — Unit test `GetRawDataForWorkerUseCase`: with mocked mongoose models (see `NFR-001`), it queries `WorkoutSession` (only non-deleted, `status: 'complete'`, sorted by `date` ascending), `WeekLog` (non-deleted, sorted by `startDate`), `Exercise`, `RoutinePlan` (scoped `createdBy`) and `UserStrengthMetric` (sorted by `measuredAt`), and maps documents to `WorkerRawDataDomain` with the documented field conversions (ObjectId → string; each `sets[]` element is mapped to a `{ reps, weights }` object, keeping the `sets` field name).
- `FR-006` — Each spec asserts behavior against a mocked `IStatsRepository` (injected under the `STATS_REPOSITORY` token) or mocked model tokens, never against the real database or SQS.

### Non-Functional Requirements

- `NFR-001` — Follow `documents/engineering/testing.md` mock patterns: provide mongoose model tokens with `{ provide: getModelToken(X.name), useValue: modelMock }` (token by class name, not schema object name). Only pure use cases are tested, so dependencies are `jest.fn()` value objects (e.g. `STATS_REPOSITORY` as `{ upsertTopExercises: jest.fn(), ... }`); the service/resolver `EventEmitter2` and `.execute()` mock-chain patterns do not apply to this Spec.
- `NFR-002` — Tests live under `src/modules/stats/**/*.spec.ts` and run with `npx jest --config jest.config.js src/modules/stats`.
- `NFR-003` — Tests reflect **current** behavior only (per `documents/engineering/testing.md` section 6); if an evolved contract is discovered, the spec is updated, not the code.
- `NFR-004` — This Spec is test-only: it must not activate the module in production, change any behavior, schema, resolver, API or deployment configuration. Re-run `npm run test:cov` after the change to confirm only the intended files are covered.

## Constraints

- Do not write integration tests that require a running database or AWS SQS; all dependencies are mocked.
- Do not expand the Spec to the `get-*` use cases (`get-top-exercises`, `get-top-routines`, `get-personal-records`, `get-adherence`) or the resolver/service layer unless explicitly handled: they depend on worker-fed data and are out of the pure-use-case scope of this Spec.
- Do not modify `src/modules/stats/` production files; only add `.spec.ts` files.

## Architecture

Test-only effort over the existing hexagonal stats module:

```
StatsEventPublisher (no tests in this spec)
StatsModule (registered but experimental)
  └─ application/use-cases/
       ├─ save-top-exercises.use-case.ts        + save-top-exercises.use-case.spec.ts   (new)
       ├─ save-top-routines.use-case.ts         + save-top-routines.use-case.spec.ts    (new)
       ├─ save-personal-records.use-case.ts     + save-personal-records.use-case.spec.ts (new)
       ├─ save-adherence.use-case.ts            + save-adherence.use-case.spec.ts       (new)
       ├─ get-raw-data-for-worker.use-case.ts   + get-raw-data-for-worker.use-case.spec.ts (new)
       └─ get-* (out of scope in this Spec)
  └─ domain/interfaces/repositories/stats.repository.interface.ts (STATS_REPOSITORY token, mocked)
```

Mock strategy per use case:
- `save-*`: instantiate the use case with `{ provide: STATS_REPOSITORY, useValue: { upsertTopExercises: jest.fn(), upsertTopRoutines: jest.fn(), upsertPersonalRecords: jest.fn(), upsertAdherence: jest.fn() } }` and assert mapping + call arguments.
- `get-raw-data-for-worker`: provide `getModelToken` for each of the five reference schemas with `useValue` models whose `.find(...).sort(...).lean().exec()` return canned documents.

## Files

- `src/modules/stats/application/use-cases/save-top-exercises.use-case.spec.ts` (new)
- `src/modules/stats/application/use-cases/save-top-routines.use-case.spec.ts` (new)
- `src/modules/stats/application/use-cases/save-personal-records.use-case.spec.ts` (new)
- `src/modules/stats/application/use-cases/save-adherence.use-case.spec.ts` (new)
- `src/modules/stats/application/use-cases/get-raw-data-for-worker.use-case.spec.ts` (new)
- `src/modules/stats/application/use-cases/save-top-exercises.use-case.ts` (reference)
- `src/modules/stats/application/use-cases/get-raw-data-for-worker.use-case.ts` (reference)
- `src/modules/stats/domain/entities/stats.domain.ts` (reference: domain mapping)
- `src/modules/stats/infrastructure/schemas/workout-session-reference.schema.ts` (reference)

## Tests

- `TEST-001` — `save-top-exercises.use-case.spec.ts` proves `FR-001` (mapping + `upsertTopExercises` argument assert).
- `TEST-002` — `save-top-routines.use-case.spec.ts` proves `FR-002`.
- `TEST-003` — `save-personal-records.use-case.spec.ts` proves `FR-003`.
- `TEST-004` — `save-adherence.use-case.spec.ts` proves `FR-004`.
- `TEST-005` — `get-raw-data-for-worker.use-case.spec.ts` proves `FR-005` (per-model query filters/sorts and output mapping, including ObjectId→string conversions and `status: 'complete'` / `deleted: { $ne: true }` filters).
- `TEST-006` — Targeted run green: `npx jest --config jest.config.js src/modules/stats`.
- `TEST-007` — Full canonical gate green: `npm run build`, `npm run lint`, `npm test`, `npm run test:e2e`.

## Acceptance Criteria

- `AC-001` — The five pure use cases have passing unit suites under `src/modules/stats/` with the mocked-token pattern; no production file in `src/modules/stats/` was modified.
- `AC-002` — `npx jest --config jest.config.js src/modules/stats` passes.
- `AC-003` — `npm run build`, `npm run lint`, `npm test` and `npm run test:e2e` remain green, and stats coverage rises from 0% for the covered files (verifiable with `npm run test:cov`).