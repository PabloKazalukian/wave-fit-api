# Mongo Connection Configuration

> **Status:** done
> **Priority:** high

## Context

`src/app.module.ts:39-41` hardcodes the database connection:

```ts
MongooseModule.forRoot(
  `mongodb+srv://kazalukianpablo_db_user:${process.env.DB_MONGO_PASSWORD}@wavefit.ofapyei.mongodb.net/ `,
),
```

Consequences of a hardcoded target, in order of how much they hurt:

1. **No isolated database is reachable.** Only the password is configurable; the host, the user and the database name are compiled into the source. Anything that needs its own database — a load test, a migration rehearsal, an isolated demo, a second environment — has no way to get one, and the only existing option is to edit `src/app.module.ts` by hand.
2. **`.env` carries dead configuration.** `MONGO_URL` and `DB_MONGO_USER` are both defined in the developer's `.env` and documented in `.env.example`, and a repository-wide search finds **zero** uses of either. The name already exists and already says what it means; only the code never reads it.
3. **The E2E layer works around the problem instead of using it.** `test/utils/app-test.module.ts` replaces `MongooseModule.forRoot` wholesale with `rootMongooseTestModule()` (`test/utils/db-handler.ts`), which spins up `mongodb-memory-server` per run. That is the right call for hermetic tests and `ADR-0003` endorses it, but it means the *only* supported database topology is "the hardcoded Atlas cluster" or "a throwaway in-process server". There is nothing in between: a real, long-lived, isolated Mongo that an application process can connect to.
4. **Configuration drifts from documentation.** `.env.example` advertises `DB_MONGO_PASSWORD` under a `# Database (MongoDB Atlas)` heading, which implies the rest of the connection is configured. It is not.

This Spec makes the connection configurable and adds the one missing topology: an isolated Mongo in Docker that a locally running API can use. It is the prerequisite for the `stats-charts` performance layer's `AC-005` (`sdd/stats-charts-performance.md`), which needs an API pointed at a dedicated performance database, but it is deliberately a **general** capability: any future feature that needs an isolated database uses it without further change.

**Scope discipline.** This Spec configures the database connection and nothing else. It does not containerize the API, does not add a compose service for it, and does not touch any other service's configuration.

## Requirements

### Functional Requirements

- `FR-001` — A new `src/config/mongo.config.ts` exports `buildMongoUri(env: NodeJS.ProcessEnv = process.env): string`. It returns `env.MONGO_URL` — trimmed — when that variable holds a non-empty value; otherwise it returns the Atlas URI currently hardcoded in `src/app.module.ts`, built from `env.DB_MONGO_PASSWORD`. The environment is a parameter, not a global read, so the resolution is testable without mutating `process.env`.
- `FR-002` — `src/app.module.ts` passes `buildMongoUri()` to `MongooseModule.forRoot(...)`. No MongoDB host literal remains anywhere under `src/`.
- `FR-003` — A `docker-compose.yml` at the repository root defines exactly one service, `mongo`: image `mongo:8.2`, a named volume for `/data/db`, a `healthcheck`, and container port `27017` published to the host. It defines **no credentials** — no `MONGO_INITDB_ROOT_PASSWORD`, no `MONGO_INITDB_ROOT_USERNAME`.
- `FR-004` — `.env.example` documents `MONGO_URL` as optional, states that omitting it keeps the current Atlas target, and shows the isolated-local value used with `docker-compose.yml`.

### Business Rules

- `BR-001` — **Default behavior is unchanged.** With `MONGO_URL` unset or blank, `buildMongoUri()` returns a string byte-identical to the literal currently inlined in `src/app.module.ts`. This is asserted by a test, not by inspection, because the difference between the current and new target is invisible at runtime and only a lock prevents a silent future divergence.
- `BR-002` — **No secret in the repository.** The URI built by the fallback carries no password: the password comes from `env.DB_MONGO_PASSWORD`, exactly as it does today. `.env` is not modified, tracked or referenced by the compose file.
- `BR-003` — **The isolated environment is opt-in.** Docker is never required to run, build or test the application. The compose file is a convenience for the cases that need a separate database; nothing in the gate, the scripts or `AppModule` starts it, connects to it or requires it to exist.
- `BR-004` — **One canonical location per piece of knowledge.** The isolated-database workflow is documented once, in `documents/engineering/local-environments.md`. `architecture.md` and `testing.md` link to it instead of restating it, and no Spec or Plan becomes a second copy of how to run it.
- `BR-005` — **A blank variable is a missing variable.** `MONGO_URL` set to whitespace falls back to the default rather than reaching the driver, because an empty connection string fails at boot with an opaque driver error that names neither the variable nor the fallback.

### Non-Functional Requirements

- `NFR-001` — **No network, no database, no Docker in the tests.** Every test in this Spec is a pure function evaluation or a static read of a repository file. None connects to Mongo and none invokes `docker`, so the suite passes offline and on a machine without a container runtime.
- `NFR-002` — **English artifacts** (Charter §8): Spec, Plan, code, test names, comments, compose keys and documentation.
- `NFR-003` — **Test-first** (Charter §4). `buildMongoUri` and the `src/app.module.ts` wiring are covered by tests written before the implementation.
- `NFR-004` — **No new dependency.** The resolution is a plain function; the compose file is read as text. `mongodb-memory-server` is not invoked and no package is added to `package.json`.
- `NFR-005` — **No collateral change.** No query, calculator, resolver, schema, GraphQL surface, domain type or other module changes. The diff is the connection, its tests, the compose file, `.env.example` and documentation.

## Constraints

- Do **not** make `MONGO_URL` required. Every environment that works today — CI, a developer machine with only the Atlas password, the E2E layer, the in-memory suites — must keep working unchanged.
- Do **not** change the value of the current Atlas URI, including its trailing space (see "The trailing space" below).
- Do **not** add a service for the API to `docker-compose.yml`, and do **not** add a Dockerfile. Containerizing the application is a separate concern; this Spec delivers the isolated database and the configurable connection, which is what the application needs to use it.
- Do **not** add an authentication requirement to the local Mongo. Local development connects without credentials on purpose: an authenticated local database adds setup to every developer's day to protect nothing.
- Do **not** modify `.env`, and do not read credentials from anywhere other than `DB_MONGO_PASSWORD`.
- Do **not** add `MONGO_INITDB_ROOT_PASSWORD` or any other secret to the compose file.

### The trailing space

The current URI ends with `/ ` — a space after the slash, inside the template literal. It is preserved verbatim in the fallback, and the test that locks the default asserts the space explicitly.

Two reasons not to "clean it up" here:

1. It is a behavior question, not a formatting question. The driver parses that URI today and the application connects, so whatever the driver does with the trailing space is the current behavior. Changing it in a configuration Spec would fold an unrelated, unverified change into a commit whose claim is "no behavior change".
2. Once it is behind `buildMongoUri()` and covered by a test, it becomes safe to evaluate on its own: read the resolved database name from the live connection, decide what it should be, and change it in a separate commit that says so.

## Architecture

```
MongooseModule.forRoot(buildMongoUri())
        │
        ├── MONGO_URL set (trimmed, non-empty) ──→ used as-is
        │        e.g. mongodb://localhost:27017/wavefit-perf
        │
        └── unset or blank ──→ mongodb+srv://kazalukianpablo_db_user:${DB_MONGO_PASSWORD}@wavefit.ofapyei.mongodb.net/ 
                 (byte-identical to today's hardcoded literal)

Topologies this makes available:

  real API process ──→ Atlas (default, unchanged)      ── the current one
  real API process ──→ compose mongo service           ── new: isolated
  E2E / unit suites ──→ mongodb-memory-server          ── existing, unchanged
```

The three topologies differ only in the URI they resolve to. The E2E layer keeps bypassing `AppModule` entirely through `rootMongooseTestModule()`, because a per-run throwaway server is the right tool for a hermetic suite and `ADR-0003` already endorses it; this Spec does not route E2E through `MONGO_URL`.

**Why a plain function and not a `registerAs` config namespace.** `@nestjs/config` is already a dependency and `ConfigModule.forRoot({ isGlobal: true })` is already in `AppModule`, so `registerAs('mongo', ...)` would be the idiomatic Nest route. It is not used here: there is exactly one value, consumed once, at module registration, before any provider exists to inject it. A namespace would add a file, a factory and an injection token to read one string at one call site, and would make the value harder to assert in a unit test. The repository's existing convention for configuration is a plain module of exported constants (`src/modules/stats-charts/stats-charts.config.ts`); this follows it. Revisit if the connection ever grows a second consumed value, such as pool or timeout options.

**Why image major `8.2`.** `mongodb-memory-server` `^11.0.1` already downloads and runs MongoDB **8.2.1** for the unit and E2E suites (verified at `node_modules/.cache/mongodb-memory-server/mongod-x64-win32-8.2.1.exe`). Pinning the compose service to the same major means an isolated Docker database behaves like the database the test suites already run against, rather than being a third, different version. The nightly performance workflow pins MongoDB `6.0` in `.github/workflows/perf.yml`; that divergence predates this Spec, is not visible in any result this Spec produces, and is left alone rather than folded in here.

## Files

- `sdd/mongo-connection-config.spec.md` (new — this Spec, authored as `mongo-connection-config.md` and promoted to `.spec.md` on reaching `done`)
- `sdd/README.md` (modify: Backlog row)
- `documents/legacy/plans/mongo-connection-config/plan.md` (new — implementation Plan, authored under `documents/plans/` and archived as Historical on completion)
- `src/config/mongo.config.ts` (new — `buildMongoUri`)
- `src/config/mongo.config.spec.ts` (new — `TEST-001`, `TEST-002`, `TEST-003`, `TEST-004`)
- `src/app.module.ts` (modify: use `buildMongoUri()`, drop the hardcoded literal)
- `docker-compose.yml` (new — the isolated `mongo` service)
- `.env.example` (modify: document `MONGO_URL`)
- `documents/engineering/local-environments.md` (new — the canonical recipe, `BR-004`)
- `documents/engineering/architecture.md` (modify: reference link only)
- `documents/engineering/testing.md` (modify: reference link from the in-memory Mongo convention)

## Tests

- `TEST-001` — `src/config/mongo.config.spec.ts`, resolution: returns `MONGO_URL` when set; trims surrounding whitespace; falls back to the Atlas URI when `MONGO_URL` is absent, empty or whitespace-only (`BR-005`); builds the fallback from the injected `DB_MONGO_PASSWORD` rather than from `process.env`; and the resolved default is **byte-identical** to the literal previously inlined in `src/app.module.ts`, trailing space included (`BR-001`). Proves `FR-001`.
- `TEST-002` — `src/config/mongo.config.spec.ts`, wiring: `src/app.module.ts` calls `buildMongoUri()`, and no file under `src/` contains the Atlas host literal. A regression lock, because the failure it prevents is invisible at runtime: re-inlining the URI restores a hardcoded target with every suite still green. Proves `FR-002`, `BR-002`.
- `TEST-003` — `src/config/mongo.config.spec.ts`, isolated environment: `docker-compose.yml` defines a `mongo` service on `mongo:8.2` with a named volume, a `healthcheck` and port `27017`, defines no service other than `mongo`, and contains no `MONGO_INITDB_ROOT_PASSWORD` or any other credential. Proves `FR-003`, `BR-002`.
- `TEST-004` — `src/config/mongo.config.spec.ts`, documentation contract: `.env.example` declares `MONGO_URL` and marks it optional. A missing line here is how the next developer ends up setting a variable nothing reads — the exact dead configuration this Spec exists to remove. Proves `FR-004`.
- `TEST-005` — Regression gate: `npm run build`, `npm run lint:ci`, `npm test`, `npm run test:e2e` pass with the suite counts unchanged. Proves `NFR-005`, `AC-004`.

All tests live in `src/config/mongo.config.spec.ts`, so `npm test` collects them with no Jest configuration change and no new collector (`NFR-001`).

## Acceptance Criteria

- `AC-001` — With `MONGO_URL` unset, `buildMongoUri()` returns a string byte-identical to the URI `src/app.module.ts` used before this Spec, and `TEST-001` fails if that ever stops being true.
- `AC-002` — With `MONGO_URL` set, the application connects to that target. Validated during implementation by booting the API against the compose `mongo` service and querying it over GraphQL.
- `AC-003` — `docker compose up -d` produces a healthy MongoDB on `localhost:27017` reachable without credentials, and `docker compose down -v` removes its data.
- `AC-004` — The canonical verification workflow passes: `npm run build`, `npm run lint:ci`, `npm test`, `npm run test:e2e`, with the unit and E2E suite counts unchanged.
- `AC-005` — No credential is committed. The repository contains no MongoDB password outside the developer's untracked `.env`, and `docker-compose.yml` defines no authentication.
- `AC-006` — `docker` is not required to build, test or run the application: nothing outside `docker-compose.yml` and its documentation references the container runtime.
- `AC-007` — The diff touches only the connection, its tests, `docker-compose.yml`, `.env.example` and documentation. No query, resolver, schema or domain type changes (`NFR-005`).

## Relationship to the stats-charts performance layer

`AC-005` of `sdd/stats-charts-performance.md` needs a running API and a dedicated performance database. The seed already accepts `--uri` and is documented as safe against a dedicated performance database (`NFR-007` there), but the application had no way to be pointed at one, which is what forced a decision between an isolated database and the real Atlas cluster. The second option would have violated `NFR-007`.

That Spec stays `in_progress` and is **not** advanced by this one. This Spec only removes the blocker; closing its `AC-005` — seeding a performance database, running the seven k6 scenarios against a live `POST /graphql`, and promoting it to `.spec.md` — remains open work on `feat/stats-charts-performance`, where the application-side defect it uncovered is already fixed.
