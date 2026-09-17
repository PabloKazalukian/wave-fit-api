# Plan: DLQ for Stats using Audit-Logs

> **Status:** Historical / Non-Authoritative
> **Executed on branch:** `feat/stats-experimental`
> **Spec:** `sdd/stats-dlq.md`
> **Closed:** 2026-09-17 — implemented and validated; the current behavior is defined by the Spec (`status: done`) and the code.

## Status

**Implemented and archived.** Historical, non-authoritative. See the Spec `sdd/stats-dlq.md` for the current contract.

**Date:** 2026-09-04
**Affected modules:** `stats`, `audit-logs`

---

## 1. Current Problem

The `StatsEventPublisher` sends events to AWS SQS when a user completes a workout or finalizes a week-log. If SQS fails:

- The error is logged with `Logger.error()` but **the event is silently lost**
- There is no persistent record of the failure
- There is no way to re-process failed events
- There are no alerts for critical errors

```typescript
// Current code in stats-event-publisher.ts (lines 97-101)
} catch (error) {
  this.logger.error(`[publishToSQS] Error al enviar mensaje a SQS: ${error.message}`, error.stack);
  // The event is lost here - no DLQ or persistence
}
```

---

## 2. Proposed Solution

Use the `audit-logs` module as a persistent **Dead Letter Queue (DLQ)**:

```
SQS fails → AuditLogsService.logAsync() → MongoDB (audit_logs collection)
```

### 2.1 Benefits

| Benefit | Description |
|-----------|-------------|
| **Persistence** | The errors are stored in MongoDB, they are not lost |
| **Queryable** | They can be queried via GraphQL (`auditLogs` query) |
| **Zero cost** | The infrastructure already exists (schema, service, tests) |
| **Fire-and-forget** | `logAsync()` does not block the original request |
| **Audit** | Complies with the project's audit pattern |
| **Extensible** | Future workers can process these logs |

### 2.2 Resulting Architecture

```
User completes workout
    ↓
StatsEventPublisher attempts to send to SQS
    ↓
┌─────────────────────────────────────────┐
│  IF SQS fails:                          │
│    → auditLogsService.logAsync({        │
│        action: 'SQS_PUBLISH_FAILED',    │
│        entity: 'StatsEventPublisher',   │
│        success: false,                  │
│        errorMessage: error.message,     │
│        metadata: { triggerType, ... }   │
│      })                                 │
├─────────────────────────────────────────┤
│  IF SQS success (optional):             │
│    → auditLogsService.logAsync({        │
│        action: 'SQS_PUBLISH_SUCCESS',   │
│        entity: 'StatsEventPublisher',   │
│        success: true,                   │
│        metadata: { triggerType, ... }   │
│      })                                 │
└─────────────────────────────────────────┘
    ↓
Original request ALWAYS succeeds
```

---

## 3. Files to Modify

### 3.1 `src/modules/stats/stats-event-publisher.ts`

**Changes:**

1. Inject `AuditLogsService` in the constructor
2. Import `AuditLogsModule` in `stats.module.ts`
3. Add success logging on SQS publish
4. Add failure logging on SQS publish

**Error log structure:**

```typescript
{
  action: 'SQS_PUBLISH_FAILED',
  entity: 'StatsEventPublisher',
  userId: Types.ObjectId,           // from the original event
  success: false,
  errorMessage: error.message,
  metadata: {
    triggerType: 'workout-session.saved' | 'week-log.finalized',
    entityId: string,                // workoutSessionId or weekLogId
    queueUrl: string,                // STATS_SQS_QUEUE_URL
    stack: error.stack,              // full stack trace
    timestamp: number,               // Date.now() of the original event
  },
  timestamp: new Date(),
}
```

**Success log structure (optional):**

```typescript
{
  action: 'SQS_PUBLISH_SUCCESS',
  entity: 'StatsEventPublisher',
  userId: Types.ObjectId,
  success: true,
  metadata: {
    triggerType: 'workout-session.saved' | 'week-log.finalized',
    entityId: string,
    queueUrl: string,
    messageId: string,               // SQS ID if available
  },
  timestamp: new Date(),
}
```

### 3.2 `src/modules/stats/stats.module.ts`

**Changes:**

- Add `AuditLogsModule` to the `imports`

---

## 4. Detailed Implementation

### 4.1 StatsEventPublisher - Modified Code

```typescript
// stats-event-publisher.ts
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class StatsEventPublisher implements OnModuleInit {
  private readonly logger = new Logger(StatsEventPublisher.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly auditLogsService: AuditLogsService,  // NEW
  ) {}

  // ... onModuleInit same ...

  private async publishToSQS(payload: {
    userId: string;
    triggerType: string;
    entityId: string;
  }): Promise<void> {
    const queueUrl = process.env.STATS_SQS_QUEUE_URL;

    if (!queueUrl) {
      this.logger.warn('[publishToSQS] STATS_SQS_QUEUE_URL not configured. Event ignored.');
      return;
    }

    try {
      const command = new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify({
          userId: payload.userId,
          triggerType: payload.triggerType,
          entityId: payload.entityId,
          timestamp: new Date().toISOString(),
        }),
        MessageGroupId: `stats-${payload.userId}`,  // CHANGE: per user, not a single group
        MessageDeduplicationId: `${payload.userId}-${payload.triggerType}-${Date.now()}`,
      });

      const result = await this.sqsClient.send(command);

      // SUCCESS LOG (optional)
      this.auditLogsService.logAsync({
        action: 'SQS_PUBLISH_SUCCESS',
        entity: 'StatsEventPublisher',
        userId: new Types.ObjectId(payload.userId),
        success: true,
        metadata: {
          triggerType: payload.triggerType,
          entityId: payload.entityId,
          queueUrl,
          messageId: result.MessageId,
        },
      });

      this.logger.log(`[publishToSQS] Event sent: ${payload.triggerType} for user ${payload.userId}`);

    } catch (error) {
      // FAILURE LOG - DLQ via AuditLogs
      this.auditLogsService.logAsync({
        action: 'SQS_PUBLISH_FAILED',
        entity: 'StatsEventPublisher',
        userId: new Types.ObjectId(payload.userId),
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
        metadata: {
          triggerType: payload.triggerType,
          entityId: payload.entityId,
          queueUrl,
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: Date.now(),
        },
      });

      this.logger.error(
        `[publishToSQS] Error sending message to SQS: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
```

### 4.2 StatsModule - Imports

```typescript
// stats.module.ts
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    // ... existing imports ...
    AuditLogsModule,  // NEW
  ],
  // ...
})
export class StatsModule {}
```

---

## 5. Additional Recommended Changes

### 5.1 MessageGroupId per User

**Current problem:** `MessageGroupId: 'workout-session-group'` serializes ALL users.

**Solution:** Change to `MessageGroupId: `stats-${userId}`` for real parallelism.

### 5.2 Improved DeduplicationId

**Current problem:** `${Date.now()}-${Math.random()}` never collides, disabling real dedup.

**Solution:** `${userId}-${triggerType}-${entityId}` to deduplicate identical events.

---

## 6. Testing

### 6.1 Unit Tests for StatsEventPublisher

Create `src/modules/stats/stats-event-publisher.spec.ts`:

```typescript
describe('StatsEventPublisher', () => {
  // Test: SQS success → logAsync with success: true
  // Test: SQS failure → logAsync with success: false
  // Test: SQS not configured → warn and early return
  // Test: publishToSQS receives the correct payload
});
```

### 6.2 Manual Verification

1. Configure `STATS_SQS_QUEUE_URL` with an invalid queue
2. Complete a workout
3. Verify that an audit log with `action: 'SQS_PUBLISH_FAILED'` is created
4. Query via GraphQL: `auditLogs({ action: 'SQS_PUBLISH_FAILED' })`

---

## 7. Email Alerts Plan (Future)

### 7.1 Simple Option: Cron Job

```typescript
// using @nestjs/schedule
@Cron('0 8 * * *')  // Daily at 8am
async checkCriticalErrors() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const errors = await this.auditLogsService.findAll({
    action: 'SQS_PUBLISH_FAILED',
    success: false,
    startDate: yesterday,
  });

  if (errors.length > 0) {
    await this.sendAlertEmail(errors);
  }
}
```

### 7.2 Real-Time Option: Event Pattern

```typescript
@OnEvent('audit-log.created')
handleAuditLog(payload: { action: string; success: boolean }) {
  if (payload.action === 'SQS_PUBLISH_FAILED' && !payload.success) {
    this.sendImmediateAlert(payload);
  }
}
```

### 7.3 AWS Option: SNS

```
Audit Log created → MongoDB Change Stream → Lambda → SNS → Email
```

---

## 8. Implementation Checklist

- [x] Inject `AuditLogsService` in `StatsEventPublisher`
- [x] Add `AuditLogsModule` to `StatsModule` imports
- [x] Add success log in `publishToSQS`
- [x] Add failure log in `publishToSQS`
- [x] Fix `MessageGroupId` per user
- [x] Fix `MessageDeduplicationId` for real dedup
- [x] Create unit tests for `StatsEventPublisher`
- [x] Verify environment variables (`AWS_ACCESS_KEY` vs `AWS_ACCESS_KEY_ID`): code keeps the names `AWS_ACCESS_KEY` / `AWS_SECRET_KEY`; no deployment-config change (per spec `NFR-004`)
- [ ] Document in `documents/modules/stats.md`
- [ ] (Optional) Implement cron job for email alerts

---

## 9. References

- **Audit Logs Module:** `src/modules/audit-logs/audit-logs.service.ts`
- **Stats Event Publisher:** `src/modules/stats/stats-event-publisher.ts`
- **SQS Publisher Pattern:** AWS SDK `@aws-sdk/client-sqs`
- **Testing Guide:** `documents/engineering/testing.md`

---

## 10. Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|--------|--------------|---------|------------|
| `logAsync()` fails saving the error | Low | Low | It already has an internal catch with `Logger.error()` |
| Performance impact from additional logs | Low | Low | `logAsync()` is fire-and-forget, does not block |
| Audit logs collection grows too much | Medium | Low | TTL index or future archival policy |
| SQS keeps failing undetected | Medium | High | Email alerts in phase 2 |

---

**Next steps:** Mark this plan as "in progress" and begin the implementation following the checklist.