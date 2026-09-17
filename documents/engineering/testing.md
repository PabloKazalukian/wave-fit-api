# Engineering Testing

> **Status:** Current
> **Last updated:** 2026-09-17

How the WaveFit API is tested: philosophy, commands, unit vs E2E split, mock patterns, coverage criteria and the current measured coverage. The operational details (where the suites live, how they are structured) are visible in the suites themselves (`test/e2e/*.spec.ts`, `src/**/*.spec.ts`).

## 1. Testing Philosophy

- Two independent suites: **unit** and **E2E**.
  - Unit tests (`src/**/*.spec.ts`) mock every dependency with Jest and run fast.
  - E2E tests (`test/e2e/*.spec.ts`) boot the full application (via `AppTestModule`) against an in-memory MongoDB (`mongodb-memory-server`) and exercise real GraphQL + HTTP through `supertest`.
- Both suites must stay green. Current baseline: **73 unit suites / 703 unit tests**, **32 E2E suites / 169 E2E tests**.
- Tests reflect the **current** behavior of the code, not historical contracts (see mock patterns, section 6).
- Test-first methodology: when implementing a Spec, write the test for each layer before its implementation. A failing requirement or test is corrected against the Spec, not by improvising around it.

## 2. Commands

Jest configuration is unified in `jest.config.js` — the single source of truth. The `jest` key was removed from `package.json`; **there is no dual Jest configuration**. `npm test` runs `jest`, which auto-detects `jest.config.js`. When invoking `jest` directly, always pass `--config jest.config.js` explicitly.

```bash
# Unit (source: src/)
npm test                                          # all of src/
npx jest --config jest.config.js <path>           # one module/file
npx jest --config jest.config.js <path> --verbose # one module/file, per-test listing
npm run test:cov                                  # unit coverage (jest --config jest.config.js --coverage)

# E2E (source: test/e2e/)
npm run test:e2e                                  # full suite (jest --config ./test/jest-e2e.json --maxWorkers=2)
npx jest --config ./test/jest-e2e.json test/e2e/auth/login.spec.ts   # single file

# Combined coverage (unit + e2e)
npm run test:e2e:cov        # e2e-only with coverage (--maxWorkers=2 --coverage) → coverage/e2e/
npm run test:cov:combined   # unit + e2e coverage + istanbul merge → coverage/combined/ and console summary
```

## 3. Unit vs E2E Split

| Suite | Location | Baseline | Command |
|---|---|---|---|
| **Unit** | `src/**/*.spec.ts` | 73 suites / 703 tests | `npm test` |
| **E2E** | `test/e2e/*.spec.ts` | 32 suites / 169 tests | `npm run test:e2e` |

- Unit tests mock dependencies with Jest (see section 6).
- E2E boots the app against in-memory MongoDB, with `cookie-parser` registered (the JWT travels in an HttpOnly cookie), GraphQL playground disabled, and the same modules as the real app.
- `test/utils/db-handler.ts` provides `rootMongooseTestModule()`, `closeInMongodConnection()` and `clearDatabase()` (clears only data collections between tests, not system collections/indices — clearing everything caused intermittent failures).
- `test/fixtures/user.fixture.ts` provides the shared test user (`test@wavefit.com` / `password123`, role `USER`).
- E2E helpers (`test/e2e/helpers/`) provide cookie extraction (`getCookieWithToken`), week-log/day-log creation, active-week queries and a complete-and-create helper for historical data.

## 4. Why `--maxWorkers=2` in E2E

With more workers, `mongodb-memory-server` and the automated seeding race and produce cross-suite data. The limit is pinned to `--maxWorkers=2` in the `test:e2e` and `test:e2e:cov` scripts.

## 5. Coverage Gates

An automated CI pipeline (GitHub Actions) runs the four canonical commands on every pull request and push to `main`; see `documents/engineering/ci-cd.md`. Coverage is **not** part of that gate: there is no automated coverage threshold. The coverage criteria below define how coverage is measured and how reports are regenerated so two reports on different dates are comparable. The measurement values in this document are the current measured baseline.

### Measurement sources

| Data | Source | Command |
|---|---|---|
| Unit % (lines/branches) | `coverage/lcov.info` (LF/LH, BRF/BRH) | `npm run test:cov` |
| E2E standalone % | `coverage/e2e/coverage-final.json` | `npm run test:e2e:cov` |
| Combined % | istanbul merge of both maps → `coverage/combined/` | `node scripts/merge-coverage.js` or `npm run test:cov:combined` |

Rules:

- Unit percentages are always computed from `lcov.info` (not from the JSON map) to stay comparable with the first report.
- Combined coverage is an istanbul **weighted merge** (sum of covered elements over sum of total elements across both suites), not a simple average.
- The Jest table `% Lines` can differ ~1pp from lcov (e.g. 2518/5024 = 50.1% vs 51.33%). Known and accepted; do not mix sources in one report.
- Excluded from coverage: `src/**/*.spec.ts`, `main.ts`; `stats/**` is listed but marked experimental; DB migrations, seed-runner and DB scripts are listed with low priority.

### Weighted qualitative reading

High-weight areas: (1) week-log (+ workout-session / extra-session), (2) AI + training-plan, (3) user / profile / session / avatar.

Semaphore thresholds (combined lines):

| Status | Criterion |
|---|---|
| Green | >= 80% combined lines, or mitigated by verified E2E |
| Yellow | 60–80%, or identified point gaps |
| Red | < 40% effective, or pure logic with no test at all |

## 6. Unit Test Mock Patterns

1. **Mongoose model tokens**: provide by class name, not schema object name — `{ provide: getModelToken(Exercise.name), useValue: exerciseModelMock }`. This matches how `MongooseModule.forFeature({ name: X.name })` registers the token. `getModelToken(ExerciseSchema.name)` produces a non-matching token because `ExerciseSchema` is a Schema instance, not the class.
2. **EventEmitter2**: resolvers emit events (`workout-session.saved`, ...) → `{ provide: EventEmitter2, useValue: { emit: jest.fn() } }`.
3. **Hexagonal services (week-log)**: the service delegates to use cases; mock `.execute()` of each use case rather than chains of the model.
4. **Interceptors**: `AuditInterceptor(reflector, auditService)` can be instantiated directly or overridden with `overrideInterceptor(...)`.
5. **Behavioral alignment**: tests must reflect **current** behavior. Known evolved contracts: `WeekLogResolver.createWeekLog` refreshes the result via `service.findOne()` after creating; `findActiveWeekLog` returns a `{ hasActiveWeek: true, week }` wrapper; `ExtraSessionService.create` auto-creates the WorkoutSession when missing (no longer throws NotFound); ExtraSession calories are `MET × 70kg × hours × factorIntensidad` with user input accepted only within ±400 cal of the estimate; Google login downloads the avatar (`getAvatarGoogle`) and uploads it via `StorageService` before signing the JWT.

Additional lessons: assert ObjectId-sensitive arguments by capturing received args and comparing `.toString()` (or provide both `_id` and `id` on mocked objects); when a test fails, first verify what the service/resolver does *today* (an evolved behavior is not a bug); adding a constructor dependency (StorageService, EventEmitter2, use cases) usually requires updating affected `.spec.ts` providers; after mass spec changes always run `npm run lint` + build + both suites.

## 7. E2E Infrastructure

- `test/utils/db-handler.ts` — in-memory MongoDB (see section 3).
- `test/utils/app-test.module.ts` — replicates real configuration: same modules as the app, `MongooseModule` pointing at in-memory MongoDB, GraphQL playground disabled, `GraphQLExceptionFilter` registered.
  - The E2E bootstrap **must** register `app.use(cookieParser())`: without it every authed call fails because the JWT travels in the HttpOnly cookie.
- `test/e2e/helpers/week-log.helper.ts`, `test/e2e/helpers/day-log.helper.ts` — cookie and tracking helpers.
- `test/e2e/types/week-log.type.ts` — reusable `expect` shapes and a GraphQL field string for week-log responses.
- Conventions: `clearDatabase()` in `beforeEach` (tests never depend on cross-run state); `createTestUser()` + login per test; verify `response.body.errors` on failures; close the active week before creating a new one when the test needs a fresh active week.

## 8. Realistic Coverage Numbers (measured 2026-08-23)

| Source | Lines | Branches |
|---|---|---|
| Unit only | 51.33% | 49.05% |
| E2E only | 54.02% | 42.39% |
| **Combined (weighted)** | **67.49%** | **60.66%** |

Observations from the same report:

- E2E contributes most in week-log (use cases 82–100%, resolver ~94%, repository ~70%) and auth.
- Cold areas: `stats` (experimental; the pure use cases, `get-raw-data-for-worker` and the SQS publisher are now covered, but the `get-*` use cases, service, resolver and repository remain uncovered), `google.service` (requires real OAuth or contract tests).
- `npm run test:cov:combined` is the single command that regenerates the measured numbers.

Historical evolution (see Git history for the reports):

| Report | Unit lines | Unit branches | Combined | Suites/T (unit) | Suites/T (e2e) |
|---|---|---|---|---|---|
| 2026-08-21 | 40.1% | 35.7% | ~60% (estimated) | 46/240 | 21/112 |
| 2026-08-23 | 50.1% | 49.1% | 67.5% / 60.7% (measured) | 55/456 | 22/117 |

> Note: coverage values differ slightly depending on the tool (lcov-based unit figures showed 51.33% lines / 49.05% branches on 2026-08-23); the report tables prefer the values as displayed by Jest/lcov with the accepted ~1pp difference. Historical coverage reports are preserved in Git history.

## 9. Test-First Methodology

Per the Spec-driven development workflow (`sdd/README.md`): write the tests of a layer before its implementation; a failing requirement is fixed against the Spec. The final verification of a done Spec runs the full gate: `npm run build` · `npm run lint:ci` · `npm test` · `npm run test:e2e`. The same gate runs automatically in CI on every pull request and push to `main`; see `documents/engineering/ci-cd.md`. Locally, `npm run lint` (with `--fix`) may be used for convenience, but CI uses `lint:ci` (no `--fix`). When a new module is born, unit specs should be written from day one.