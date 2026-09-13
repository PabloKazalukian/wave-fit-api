# Plan: Idempotency, Rate Limit, Logging and Retry in plan generation (training-plan / AI)

> **Status:** Historical / Non-Authoritative

## Status

Approved as an implementation plan (dated 2026-08-23). The mechanisms it describes are implemented in the AI and training-plan modules. This plan is kept for traceability and historical review only; the authoritative source of truth is the Spec and the Code.

---

## Original user prompt

> well, I want you to design a plan to implement in training-plan for:
>
> 1. Idempotency in generation.
> 2. Per-user rate limit,
> 3. Differentiated failure logging,
> 4. retry/backoff against groq failures.
>
> I will now detail them:
>
> **Implement an in-memory lock per userId in PlanGeneratorService:** if there is already a generation in progress for that user, the second invocation must wait on the same in-flight promise (not fire a second call to Groq). Use a `Map<string, Promise<GeneratePlanResult>>` with cleanup in finally. If two invocations arrive with a different "comment" while the first is still in flight, the second must be rejected with an explicit error ("there is already a generation in progress") instead of silently returning the first's result with the wrong comment.
>
> **Fixed window counter in the AI module** (not in training-plan), using Mongo since it is the only state dependency in the project:
> - Schema `ai-usage.schema.ts`: userId, windowStart (start of the UTC day), count, with unique index `{ userId: 1, windowStart: 1 }`.
> - Service `AiRateLimitService.assertWithinLimit(userId)`: findOneAndUpdate with upsert + atomic `$inc`; if count exceeds the limit (env `AI_DAILY_LIMIT`, default 10), throw HttpException 429.
> - Handle the race on the first concurrent insert (E11000 duplicate index): catch and retry once, do not let it explode as a generic error.
> - Cut point: at the start of `AiService.executePrompt`, before invoking the model. This protects any future consumer of the AI module, not only training-plan.
> - Add the 429 code to the GraphQL exception filter error mapping so it does not fall into INTERNAL_SERVER_ERROR.
>
> **Add a Logger to AiService and PlanGeneratorService** (neither class has one today). Log (use audit-log where possible):
> - In AiService.executePrompt: provider, call duration, tokensUsed, and in catch classify the cause (timeout / HTTP status / unknown error) before re-throwing.
> - In rawResponse parsing: if JSON.parse fails, log the truncated raw content (first ~500 chars) before throwing, to diagnose malformed JSON post-mortem.
> - If validation of exerciseId against the real catalog exists or is added, log the list of invalid IDs received (relevant due to the string-vs-ObjectId bug already mentioned).
> - Use a minimal cause taxonomy to filter in logs: AI_PROVIDER_ERROR, AI_MALFORMED_JSON, AI_UNKNOWN_EXERCISE_ID, RATE_LIMIT_EXCEEDED.
> - Migrate the loose console.log/console.error you find in the generation flow to Logger, for consistency.
>
> **The flow is synchronous** (the user waits on screen), so the mechanism must be bounded:
> - Explicitly configure the ChatGroq client with timeout (~45s) and maxRetries (~2) from the SDK.
> - Add a single external retry layer in AiService: max 2 total attempts, short fixed backoff (~1s), only for transient errors (network/timeout/HTTP 5xx/429). If a 429 brings Retry-After, respect it. Validation/parsing errors MUST NOT be retried (they are not transient).
> - Define a total time budget shared between retries (not each attempt with its own independent timeout without an aggregate ceiling), so the user's wait is not stretched beyond ~60-90s worst case.
> - Integrate with the logging of point 3: each failed attempt is logged with its cause before the next attempt.

---

## Decisions confirmed by the user

| Question | Decision |
|---|---|
| SDK maxRetries + external retry layer? | **`maxRetries=0` in SDK**: ChatGroq only with timeout=45s. The external layer controls the retries (max 2 retries), short backoff, `Retry-After` on 429 and a global deadline (~80s). Bounded worst case. |
| What to do with invalid exerciseId? | **Log + reject with 400**: validate against the catalog already loaded for the prompt; if there are unknown IDs, log them with cause `AI_UNKNOWN_EXERCISE_ID` and fail fast with 400, avoiding broken WeekLog/sessions. |

---

## Phase A — 429 mapping in exception filter

**File:** `src/common/filters/gql-exception.filter.ts`

- Add `429: 'TOO_MANY_REQUESTS'` to the `getHttpErrorCode()` map (lines 162-173). Nothing else is needed: `handleHttpException` already routes any `HttpException`.

---

## Phase B — Per-user rate limit (AI module)

### New files

| File | Content |
|---|---|
| `src/modules/ai/schemas/ai-usage.schema.ts` | `AiUsage`: `userId` (ObjectId, index), `windowStart` (Date), `count` (default 0). Unique composite index `{ userId: 1, windowStart: 1 }`. Optional TTL on `windowStart` (~2 days) for auto-purging |
| `src/modules/ai/ai-rate-limit.service.ts` | See below |
| `src/modules/ai/ai-rate-limit.service.spec.ts` | Tests of the service |

### `AiRateLimitService.assertWithinLimit(userId)`

1. `windowStart` = UTC midnight of the current day (`Date.UTC(y, m, d)`).
2. Limit: `process.env.AI_DAILY_LIMIT` (default **10**).
3. `findOneAndUpdate({ userId, windowStart }, { $inc: { count: 1 } }, { upsert: true, new: true })` — atomic.
4. Catch of `E11000` (first concurrent insert race): **retry once** the same operation; if it fails again, re-throw mapped (not a generic error).
5. If `doc.count > limit` → `new HttpException({ message: 'Daily generation limit reached', code: 'RATE_LIMIT_EXCEEDED', limit, resetAt }, 429)`.

### Wiring

`ai.module.ts` adds `MongooseModule.forFeature([{ name: AiUsage.name, schema: AiUsageSchema }])` and registers/exports `AiRateLimitService`.

### Cut point

Start of `AiService.executePrompt` (`src/modules/ai/ai.service.ts:17`):

- The options object gains an optional `userId?: string` field (backwards-compatible with other callers).
- If `userId` comes → `assertWithinLimit(userId)`. `PlanGeneratorService` passes it.

> Explicit assumption: 1 generation = 1 consumed unit even if Groq fails internally (internal retries do not add up); no refund on failure.

---

## Phase C — Idempotency lock in `PlanGeneratorService`

In `src/modules/training-plan/plan-generator/plan-generator.service.ts`:

```ts
private readonly inFlight = new Map<string, {
  comment: string;
  promise: Promise<GeneratePlanResult>;
}>();
```

Flow of `generatePlan(userId, comment)`:

1. If there is an entry for `userId`:
   - same `comment` → return the in-flight promise (shares the result, does not fire a second call to Groq nor create a second Goal);
   - different `comment` → `ConflictException('There is already a plan generation in progress for this user')` (409, already mapped by the filter).
2. If there is no entry: register `{ comment, promise }` **synchronously** before the first `await` (closes the check-then-act gap), execute the current body in a private `doGenerate()` method.
3. **Cleanup in `finally`** with identity guard (`if (this.inFlight.get(userId) === entry)`) so a newer entry is not deleted.
4. Waiters share the same promise: they receive the result or the error naturally.

Documented limitation: per-instance in-memory lock (valid with single-node deploy; there is no Redis in the project).

---

## Phase D — Differentiated logging

### Taxonomy (new `src/modules/ai/ai-error-causes.ts`)

```ts
export const AI_CAUSE = {
  PROVIDER: 'AI_PROVIDER_ERROR',
  MALFORMED_JSON: 'AI_MALFORMED_JSON',
  UNKNOWN_EXERCISE_ID: 'AI_UNKNOWN_EXERCISE_ID',
  RATE_LIMIT: 'RATE_LIMIT_EXCEEDED',
} as const;
```

### Changes per class

| Class | Changes |
|---|---|
| `AiService` | Add `Logger` + inject `AuditLogsService` (importing `AuditLogsModule` in `AiModule`). Measure `durationMs` per attempt. Success: `logger.log` + `auditLogService.logAsync({ action: 'AI_PROMPT_EXECUTED', entity: 'Ai', userId, success: true, metadata: { provider, modelUsed, durationMs, tokensUsed } })`. In catch: classify cause (helper below), `logger.error` with context, fire-and-forget audit with `success: false`, and re-throw. Remove the commented `console.log` (L49) |
| `PlanGeneratorParser` | Add `Logger`. Wrap `JSON.parse`: if it throws, log `AI_MALFORMED_JSON` + truncated raw content (500 chars) and throw a clear `BadRequestException` |
| `PlanGeneratorService` | Add `Logger` + `AuditLogsService`. Log start/finish with total duration. New validation of `exerciseId` against the already-loaded catalog (`Set` of `String(e.id)`): if there are invalid ones → log the list with cause `AI_UNKNOWN_EXERCISE_ID` + audit + `BadRequestException` with the IDs. Minor fix: remove the double `JSON.parse(rawContent)` (L123), reuse the parsed value. Final audit `TRAINING_PLAN_GENERATED` |

### Classification helper (in `AiService`, reused by Phase E)

Inspects `err.code` (`ETIMEDOUT`/`ECONNABORTED`), timeout message, `err.response?.status || err.status`, and returns the taxonomy cause.

Out of scope: the `console.error` of week-log (`create-week-log.use-case.ts`) do not belong to this flow; they remain pending for another task.

---

## Phase E — Retry/backoff against Groq failures

### SDK config (`src/modules/ai/providers/groq.provider.ts`)

```ts
new ChatGroq({
  ...,
  timeout: Number(process.env.AI_CALL_TIMEOUT_MS ?? 45000),
  maxRetries: 0,
});
```

### External layer (loop inside `executePrompt`, replacing the direct call of L40)

- `maxAttempts` = `AI_MAX_ATTEMPTS` (default **3**: 1 initial + 2 retries).
- Global budget: `deadline = Date.now() + AI_TOTAL_BUDGET_MS` (default **80000**). Before each attempt and each sleep it is verified that it fits in the budget; if not, cut and throw the last error.
- Short fixed backoff: `1000ms * attempt` (cap 4s), except 429 with `Retry-After` header (parse seconds/date, clamped to the remaining budget).
- Only transient errors are retried: network/timeout, HTTP 5xx, 429. 4xx and parsing/validation errors are **not** retried.
- Each failed attempt: `logger.warn` with attempt/max, cause, status and `durationMs` (integration with Phase D). The final audit-log is emitted only once with the outcome.

---

## New environment variables

`.env` + section 13 of `AGENTS.md`:

```
AI_DAILY_LIMIT=10
AI_CALL_TIMEOUT_MS=45000
AI_MAX_ATTEMPTS=3
AI_TOTAL_BUDGET_MS=80000
```

---

## Tests (Jest unit, `npx jest --config jest.config.js <path>`)

| Spec | Key cases |
|---|---|
| `gql-exception.filter.spec.ts` (new) | 429 → `extensions.code = 'TOO_MANY_REQUESTS'`, `status: 429` |
| `ai-rate-limit.service.spec.ts` (new) | upsert+$inc; exceeds limit → HttpException 429; E11000 first attempt → retries and succeeds; E11000 twice → propagates mapped |
| `ai.service.spec.ts` (update) | provide mocks of `AiRateLimitService` and `AuditLogsService`; cuts rate limit when `userId` comes; transient retry → 2nd attempt OK (`jest.useFakeTimers`); 400 → no retry; budget exhausted → only 1 attempt; causes classified in logs (`Logger` spy) |
| `plan-generator.service.spec.ts` (update) | 2 concurrent calls same comment → `executePrompt` 1 time and same result; different comment in flight → `ConflictException`; after a failure the lock is cleaned (3rd call generates); invalid IDs → 400 + log with cause |

At the end: full suite (`npm test`) + `npm run lint`.

---

## Execution order

A (filter) → B (rate limit) → C (lock) → D (logging) → E (retry/backoff, depends on the classifier of D) → tests/lint per phase.