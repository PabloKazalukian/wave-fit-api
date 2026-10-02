# Local Environments

> **Status:** Current
> **Last updated:** 2026-10-02

Which database a run of this API talks to, how to give a run its own database, and what changes when you do.

The connection target is resolved by `buildMongoUri()` in `src/config/mongo.config.ts`, which `AppModule` passes to `MongooseModule.forRoot`. The contract is `sdd/mongo-connection-config.spec.md`.

## 1. The three topologies

| Topology | Where the data lives | When to use it |
|---|---|---|
| **Shared Atlas cluster** | The real database. Default whenever `MONGO_URL` is unset or blank | Day-to-day development, and every deployed environment |
| **Isolated container** | `docker-compose.yml`, a MongoDB on `localhost:27017`, no credentials | Anything that must not touch shared data: a performance run, a migration rehearsal, an isolated demo, reproducing a bug with disposable data |
| **In-memory server** | `mongodb-memory-server`, inside the test process, discarded afterwards | The automated suites only. `npm test` and `npm run test:e2e` supply their own connection and never read `MONGO_URL` — see `documents/engineering/testing.md` sections 3 and 7 |

The default is the shared cluster because that is what every environment used before the connection became configurable, and changing it would repoint working setups silently. `MONGO_URL` is the opt-out.

## 2. Pointing a run at a specific target

`MONGO_URL` wins whenever it holds a non-empty value. A blank or whitespace-only value counts as unset, so `MONGO_URL=` in an environment file means "keep the default" rather than "fail to connect".

```bash
# PowerShell
$env:MONGO_URL="mongodb://localhost:27017/wavefit-perf"
npm run start:dev
```

```bash
# bash
MONGO_URL="mongodb://localhost:27017/wavefit-perf" npm run start:dev
```

Process environment wins over `.env`: `ConfigModule` loads `.env` without overriding variables already set in the shell, so an exported `MONGO_URL` is not silently replaced by the file.

Pick the database name deliberately — the path is part of the target, so `mongodb://localhost:27017/wavefit-perf` and `mongodb://localhost:27017/other-name` are different databases on the same server.

## 3. The isolated container

```bash
docker compose up -d          # start
docker compose ps             # status; "healthy" once Mongo answers its healthcheck
docker compose down           # stop, keep the data
docker compose down -v        # stop and delete the data
```

The service runs `mongo:8.2`, the same major `mongodb-memory-server` already uses for the unit and E2E suites, so an isolated database behaves like the one the tests run against. Data lives in the named volume `mongo-data`, which is why `down` keeps it and `down -v` removes it.

There is **no** service for the API and no Dockerfile: the application runs on the host and reaches the container over `localhost`. Containerizing the application is a separate concern, and nothing in the build, the gate or the application requires a container runtime to exist.

**The container has no authentication.** That is deliberate — local credentials would protect nothing and would cost every developer a setup step on every machine. It also means the port must never be reachable from anywhere but the developer's own machine.

### What happens when the API boots against it

The application seeds itself on every boot: 30 exercises, 6 routine days and the PPL routine plan, each step guarded by a check for existing data. The full flow and its idempotency rules are in `documents/engineering/seed.md`; the operational consequence is all that matters here:

> **Load your own data before booting the API.**

If the API boots first into an empty database, the autoseed claims it: it inserts the exercise catalog under Mongo-generated `_id`s. Any later load that inserts exercises by its own `_id` then collides with the `name` unique index of `exercise.schema.ts` and fails with `E11000`. The reverse order is safe — with data already present, every autoseed step finds what it expects and skips.

## 4. Cleaning up

`docker compose down -v` removes the container, the network and the volume. Nothing outside the volume survives, and nothing it ever held reaches another topology.
