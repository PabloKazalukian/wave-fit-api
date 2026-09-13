> **Status:** Current
> **Last updated:** 2026-09-12

# ADR-0007: Stats delegated to an external SQS worker

## Context

Per-user statistics (top exercises, top routines, personal records, adherence) require heavy aggregation over the tracking collections (`WorkoutSession`, `WeekLog`, `Exercise`, `RoutinePlan`, `UserStrengthMetric`). Computing them synchronously on every write would slow down or block the main tracking flow, and computing them on read would make dashboard queries expensive. The workload is sporadic (only when a workout is saved or a week is finalized) and decoupled in time from the request that triggers it.

## Decision

Delegate the computation to an **external worker/Lambda driven through AWS SQS**, never computing statistics inside NestJS:

1. `StatsEventPublisher` listens to `workout-session.saved` and `week-log.finalized` events and publishes a message to SQS.
2. The worker reads the message and calls `getRawDataForWorker(userId)` to fetch the raw data.
3. The worker computes the four metrics (top exercises, top routines, personal records, adherence) and writes them back through `saveTopExercises`, `saveTopRoutines`, `savePersonalRecords`, `saveAdherence`.
4. NestJS only **upserts** the computed results (one document per user per metric, unique index on `userId`).
5. The frontend reads precomputed results via the `get-*` queries.

Endpoint split: user reads use the `GqlAuthGuard` (user cookie, ADR-0001); worker endpoints use `ServiceAuthGuard` with a service JWT (`role: SERVICE`, scopes `stats:read` / `stats:write`) and an explicit `userId` argument from the SQS message.

Fail-open behavior: if `STATS_SQS_QUEUE_URL` is not configured, the publisher starts but silently skips sending — the stats module never blocks the main tracking flow.

## Consequences

- **Positive:** heavy aggregation is off the request path; the tracking flow is never blocked by stats infrastructure; the worker can be scaled independently and implemented outside NestJS (a Python Lambda is sketched in `LAMBDA.md`); a shared `STATS_SQS_QUEUE_URL` allows the pipeline to be toggled by configuration.
- **Negatives:** an external dependency (SQS plus the worker) is required for stats to actually be computed; results are eventually consistent with the triggering writes; the service needs worker endpoints guarded by a second authentication style.
- **Known gap — no DLQ:** if publishing to SQS fails, the error is only logged and the event is lost silently; there is no persistent record and no way to reprocess. A pending plan (`documents/plans/stats-dlq-audit-logs.md`) proposes reusing the audit-logs module as a persistent Dead Letter Queue.

The module is implemented (resolver, use cases, repository, schemas, publisher) but **experimental**: not active in production and kept outside the test suite (0% coverage).

## Status

Accepted