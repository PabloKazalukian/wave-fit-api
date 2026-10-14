# Plan — Mongo Connection Configuration

> **Status:** Historical / Non-Authoritative
> **Spec:** `sdd/mongo-connection-config.spec.md`
> **Executed on branch:** `feat/mongo-connection-config`
> **Last updated:** 2026-10-02

Execution artifact. Not authoritative. See the Spec for behavior and `sdd/README.md` for governance.

Implemented in full: `TEST-001` through `TEST-005` and every acceptance criterion pass, and the canonical verification workflow is green. The authoritative contract is `sdd/mongo-connection-config.spec.md`. This plan is kept for traceability and historical review only.

## Approach

The database connection is compiled into `src/app.module.ts`. One function decides where the application connects, its fallback reproduces today's target byte for byte, and one compose file provides the isolated database that no topology currently offers.

The load-bearing decision is `BR-001`: **the default must be byte-identical to the current literal**, including its trailing space. A configuration change that silently repoints a developer machine or CI at a different database is not a configuration change; it is an incident that only surfaces when someone notices the data is gone. `TEST-001` therefore asserts the exact string rather than asserting "it looks like an Atlas URI".

The second decision is scope. The tempting move is to containerize the API as well, which would make `docker compose up` a complete isolated environment. It is declined: it needs a Dockerfile, a build strategy, and node_modules in an image, none of which this Spec needs to deliver its capability. The capability is "a real API process can connect to its own Mongo" — a Mongo service plus a configurable connection delivers exactly that, and the application can run on the host or in a container without either being a precondition of the other.

## Tasks

| # | Task | Files | Test | Validate |
|---|---|---|---|---|
| 1 | Spec + Plan | `sdd/`, `documents/plans/` | — | — |
| 2 | Resolver + wiring tests | `src/config/mongo.config.spec.ts` | `TEST-001`, `TEST-002` | `jest src/config` |
| 3 | `buildMongoUri` | `src/config/mongo.config.ts`, `src/app.module.ts` | `TEST-001`, `TEST-002` | `jest src/config` |
| 4 | Compose contract test | `src/config/mongo.config.spec.ts` | `TEST-003` | red, then green |
| 5 | `docker-compose.yml` | `docker-compose.yml` | `TEST-003` | `docker compose up -d`, `ps`, `down -v` |
| 6 | `.env.example` | `.env.example` | `TEST-004` | `jest src/config` |
| 7 | Isolated-environment docs | `documents/engineering/local-environments.md`, `architecture.md`, `testing.md` | — | manual |
| 8 | Canonical gate | — | `TEST-005` | `build`, `lint:ci`, `test`, `test:e2e` |

Task 2 precedes task 3 so the resolver is specified by its tests before it exists, and task 4 precedes task 5 so the compose file's contract is written before the file.

## Byte-identity of the default

The literal currently in `src/app.module.ts` is a template expression, not a fixed string, because it interpolates `process.env.DB_MONGO_PASSWORD`. "Byte-identical" is therefore about the assembled result:

```
mongodb+srv://kazalukianpablo_db_user:<DB_MONGO_PASSWORD>@wavefit.ofapyei.mongodb.net/␠
```

with `<DB_MONGO_PASSWORD>` being whatever that variable holds and `␠` a literal space before the end of the URI. `TEST-001` builds the expected string in the test and compares it with `toBe`, so a dropped space, a reordered credential or an added database name all fail. `env` is a parameter of `buildMongoUri`, which is what makes this testable without mutating `process.env` — and it also means the password is read at call time rather than captured at module load, matching the behavior of the current inline template.

## Why `MONGO_URL` and not a new name

`.env` and `.env.example` already define `MONGO_URL`, and a repository-wide search finds no use of it. The variable already exists, already carries the standard name, and is already present in every developer's environment. Introducing a differently named variable would leave two names for one concept and leave the dead one in place.

## Out of scope

- **A Dockerfile or an API service in the compose file.** Declined in the Spec for the reasons above; adding it later does not invalidate anything here.
- **The trailing space in the default URI.** Preserved and tested. Once the URI is behind `buildMongoUri()` it becomes safe to evaluate and change on its own.
- **The MongoDB major version in `.github/workflows/perf.yml`** (6.0), which does not match the 8.2.1 that `mongodb-memory-server` runs. Predates this Spec and produces no observable difference in what it validates.
- **Rerouting the E2E layer through `MONGO_URL`.** `rootMongooseTestModule()` stays: a per-run throwaway server is what makes the suite hermetic, and `ADR-0003` endorses it.
- **Any other service's configuration.** Only the database.

## Validation

Per task: `npx jest --config jest.config.js src/config` for the unit layer.

Final gate: `npm run build`, `npm run lint:ci`, `npm test`, `npm run test:e2e`, with unit and E2E suite counts unchanged.

Environment validation is deliberately **not** part of the automated gate: `NFR-001` keeps Docker out of the tests, so the compose service is verified once by hand during implementation and recorded in the log below.

### Validation log

| Item | Result |
|---|---|
| `TEST-001` (resolution, byte-identical default) | green — 13 tests in `src/config/mongo.config.spec.ts`, including the `MONGO_URL` set / trimmed / blank / absent cases and the `process.env` independence check |
| `TEST-002` (AppModule wiring, no stray host under `src/`) | green — walks `src/`; only `mongo.config.ts` and its spec may name the host |
| `TEST-003` (compose contract) | green — single `mongo` service, `mongo:8.2`, named volume, healthcheck, `27017:27017`, no credentials |
| `TEST-004` (`.env.example` contract) | green — `MONGO_URL` declared, marked optional, shows the isolated target |
| `AC-002` (API against the compose Mongo) | green — a second instance booted on `PORT=3100` with `MONGO_URL=mongodb://localhost:27017/wavefit-perf`, connected, served `/graphql`, and wrote only to `wavefit-perf`. The `:3000` instance was not touched. Instance stopped afterwards. |
| `AC-003` (`up -d` / healthy / `down -v`) | green — container reported `Up (healthy)`, `down -v` removed container, network and volume, and port 27017 closed afterwards |
| `AC-004` (canonical gate) | green — see below |
| `AC-001`, `AC-005`, `AC-006`, `AC-007` | green — byte-identity locked by `TEST-001`, no credential in the compose file or the source, `docker` referenced only by `docker-compose.yml` and its documentation, and the diff is limited to the connection, its tests and documentation |

### Findings during validation

**The application seeds itself into an isolated database.** Booting the API against an empty container ran `SeedService.onApplicationBootstrap()` and inserted 30 exercises, 6 routine days and the PPL plan. That is `documents/engineering/seed.md` behaviour and not a defect, but it has an operational consequence worth its own documentation: **load your own data before booting the API**, because the autoseed claims the exercise catalog under Mongo-generated `_id`s and a later load inserting exercises by its own `_id` then collides with the unique `name` index. It is recorded in `documents/engineering/local-environments.md` section 3, and it is a blocker for the order of operations of the `stats-charts` performance layer's `AC-005`, which is handled on that branch and not here.

**The Atlas default was never at risk.** The first assertion of this Spec is that a run with `MONGO_URL` unset connects exactly where it connected before, and the validation exercised the opposite branch without touching shared data: the container held exactly the seed's 30 exercises, 6 routine days, 1 plan and 0 users, and the log showed insertion rather than the skip it would have logged against a populated cluster.

