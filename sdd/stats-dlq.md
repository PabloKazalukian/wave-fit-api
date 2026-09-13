# Stats SQS DLQ via Audit-Logs

> **Status:** Draft
> **Priority:** low

## Context

The experimental `stats` module publishes events to AWS SQS when a user completes a workout or finalizes a week-log (`StatsEventPublisher` subscribes to `workout-session.saved` and `week-log.finalized`). Today, when SQS fails, the error is only logged with `Logger.error()` and **the event is lost silently**: there is no persistent record of the failure, no queryable trace, and no way to reprocess failed events. No alerts exist for critical delivery errors.

This Spec distills `documents/plans/stats-dlq/plan.md` into an executable contract: use the existing `audit-logs` module as a persistent Dead Letter Queue (DLQ) and fix the SQS publisher error handling. The Plan is the originating reference; this Spec is the contract to implement.

Current failure path (`stats-event-publisher.ts`, around lines 97-101):

```typescript
} catch (error) {
  this.logger.error(`[publishToSQS] Error al enviar mensaje a SQS: ${error.message}`, error.stack);
  // El evento se pierde aquí - no hay DLQ ni persistencia
}
```

## Requirements

### Functional Requirements

- `FR-001` — On SQS publish failure, persist a DLQ record via `AuditLogsService.logAsync` with `action: 'SQS_PUBLISH_FAILED'`, `entity: 'StatsEventPublisher'`, `success: false`, `errorMessage`, and `metadata` containing `triggerType` (`'WORKOUT_SESSION' | 'WEEK_LOG_FINALIZED'`, the values in the payload emitted by `workout-session.saved`/`week-log.finalized`), `entityId`, `queueUrl` (from `STATS_SQS_QUEUE_URL`), full `stack`, and the original event `timestamp`.
- `FR-002` — On SQS publish success, log an optional audit record `action: 'SQS_PUBLISH_SUCCESS'`, `entity: 'StatsEventPublisher'`, `success: true`, with `triggerType`, `entityId`, `queueUrl` and the SQS `messageId` when available.
- `FR-003` — If `STATS_SQS_QUEUE_URL` is not configured, warn and return early (event ignored); no DLQ record is written for the missing-config case.
- `FR-004` — The original HTTP/GraphQL request making the event publish finishes successfully regardless of SQS state (`logAsync` is fire-and-forget and does not rethrow).
- `FR-005` — Fix `MessageGroupId` from the global group (`'workout-session-group'`, which serializes all users) to per-user `stats-${userId}` for real parallelism.
- `FR-006` — Fix `MessageDeduplicationId` from `Date.now()-Math.random()` (never collides, disables real dedup) to `${userId}-${triggerType}-${entityId}` so identical events are deduplicated.
- `FR-007` — Provide a reprocessing path: failed events are queryable via the existing GraphQL `auditLogs` (filter `action: 'SQS_PUBLISH_FAILED'`, `success: false`), and the queue is re-sent from the persisted metadata (`triggerType`, `entityId`, `userId`).

### Business Rules

- `BR-001` — A failed SQS delivery must never break the originating workout/week-log request.
- `BR-002` — Every failed publish must be persisted and queryable (traceability); no silent loss of events.

### Non-Functional Requirements

- `NFR-001` — `logAsync` must not block the original request (fire-and-forget, with its own internal `Logger.error` catch).
- `NFR-002` — The DLQ record must not include secrets or PII beyond the event identifiers already published.
- `NFR-003` — The `stats` module stays experimental and outside the production test gate scope (see `documents/modules/stats.md`); tests for this Spec are written under `src/modules/stats/` and follow the mock patterns of `documents/engineering/testing.md` section 6 (e.g. provide `EventEmitter2` as `{ emit: jest.fn() }`, provide mongoose model tokens by class name).
- `NFR-004` — No application behavior outside the publisher changes: no schema, resolver, API or deployment-config changes beyond `stats.module.ts` imports and the publisher itself.

## Constraints

- Do not create a new DLQ collection or service; reuse `src/modules/audit-logs/audit-logs.service.ts` (`AuditLogsService.logAsync`).
- Do not introduce a worker or email/cron alerting in this Spec (future work, see `documents/plans/stats-dlq/plan.md` section 7); the reprocessing path is documented, not implemented as a background job.
- Do not change tracking modules (workout-session, week-log) or their event emissions.
- Keep the publisher signature stable for its listeners.

## Architecture

```
User completes workout / week-log finalized
    ↓
StatsEventPublisher.publishToSQS(payload)        [onModuleInit → EventEmitter2 listeners]
    ↓
┌────────────────────────────────────────────────────────────┐
│ If STATS_SQS_QUEUE_URL missing: warn + return (event ignored)│
├────────────────────────────────────────────────────────────┤
│ On success:                                                 │
│   auditLogsService.logAsync({ action: 'SQS_PUBLISH_SUCCESS',│
│     entity: 'StatsEventPublisher', success: true,           │
│     metadata: { triggerType, entityId, queueUrl, messageId }})│
├────────────────────────────────────────────────────────────┤
│ On failure (DLQ):                                           │
│   auditLogsService.logAsync({ action: 'SQS_PUBLISH_FAILED', │
│     entity: 'StatsEventPublisher', success: false,          │
│     errorMessage, metadata: { triggerType, entityId,        │
│       queueUrl, stack, timestamp }})                        │
└────────────────────────────────────────────────────────────┘
    ↓
Original request always succeeds
```

Reprocessing (documented workflow): query `auditLogs({ action: 'SQS_PUBLISH_FAILED' })`, reconstruct the SQS message from `metadata`, and re-send via the queue URL; after a successful resend the record can be marked resolved out-of-band.

## Files

- `src/modules/stats/stats-event-publisher.ts` (modify: inject `AuditLogsService`, success/failure `logAsync`, per-user `MessageGroupId`, real `MessageDeduplicationId`)
- `src/modules/stats/stats.module.ts` (modify: add `AuditLogsModule` to `imports`)
- `src/modules/stats/stats-event-publisher.spec.ts` (new: unit tests, see `TEST-001`)
- `src/modules/audit-logs/audit-logs.service.ts` (reference: `logAsync` contract; not modified by this Spec)

## Tests

- `TEST-001` — Unit: `src/modules/stats/stats-event-publisher.spec.ts` covers: SQS success → `logAsync` with `success: true`; SQS failure → `logAsync` with `success: false` and full metadata; missing `STATS_SQS_QUEUE_URL` → warn and early return; `publishToSQS` receives the correct payload; `MessageGroupId` is `stats-${userId}`; `MessageDeduplicationId` is `${userId}-${triggerType}-${entityId}`.
- `TEST-002` — Verification: `npx jest --config jest.config.js src/modules/stats`.

## Acceptance Criteria

- `AC-001` — An SQS failure while completing a workout or finalizing a week-log no longer loses the event: a `SQS_PUBLISH_FAILED` audit log is persisted with the documented metadata.
- `AC-002` — `auditLogs({ action: 'SQS_PUBLISH_FAILED' })` returns the failed publishes, enabling the reprocessing workflow.
- `AC-003` — The originating request completes successfully on both success and failure paths of the publisher.
- `AC-004` — SQS messages are grouped per user (`stats-${userId}`) and deduplicated by `${userId}-${triggerType}-${entityId}`.
- `AC-005` — `npm run build`, `npm run lint` and `npm test` pass; `npm run test:e2e` remains green (no tracking behavior changed).