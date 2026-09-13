# AI Module - Cross-cutting LLM Access Layer

> Part of the stable module documentation. Specs live under `sdd/`; this document describes the implemented system state.
> **Status:** Current
> **Last updated:** 2026-09-12

## Role

The `ai/` module is a **cross-cutting layer** (not a domain): it exposes the single LLM call point of the project (`AiService.executePrompt`), per-user rate limiting, retries with a global budget, and auditing. It is consumed by generation modules such as `training-plan`. Generation-plan documentation lives in `documents/modules/training-plan.md`.

`AiService.executePrompt()` is the **only LLM call point** in the project. It orchestrates:

1. **Rate limit** per user (daily UTC fixed window) before invoking the model.
2. Resolving the **provider** from the `'AI_PROVIDERS'` registry (strategy pattern).
3. Building LangChain messages (`SystemMessage` + `HumanMessage`).
4. **Retries** of transient errors with backoff and a **global time budget**.
5. **Auditing** (`AI_PROMPT_EXECUTED`) and logging of cause/duration/tokens.

```ts
const { rawContent, modelUsed, promptUsed, tokensUsed } =
  await aiService.executePrompt({
    providerName: 'groq',
    systemPrompt,
    userPrompt,
    userId, // optional: if passed, applies per-user rate limit
  });
```

## Providers (`AI_PROVIDERS`)

- Interface `IAiProvider { name: string; getModel(): BaseChatModel }` in `interfaces/ai-proider.interface.ts`.
- Registry via token `'AI_PROVIDERS'` (a `Map<name, provider>`) built in `ai.module.ts` (strategy pattern; exported for consumers).
- Today only **`GroqProvider`** exists (`name = 'groq'`):
  - Model: `openai/gpt-oss-120b`
  - `temperature: 0`, `reasoningEffort: 'low'`
  - `maxTokens` from `AI_MAX_OUTPUT_TOKENS` (default 5000)
  - `timeout` from `AI_CALL_TIMEOUT_MS` (default 45000)
  - `maxRetries: 0` - **the only retry layer lives in `AiService`** (not in the SDK).
  - Adding a new provider = implement `IAiProvider`, register it in `ai.module.ts`.

## Rate limit

- Collection `ai_usage` (`schemas/ai-usage.schema.ts`): `userId`, `windowStart`, `count`.
  - Unique index `{ userId, windowStart }` - one window per user and day.
  - **TTL** index on `windowStart` (2 days) - automatic purge.
- `AiRateLimitService.assertWithinLimit(userId)`:
  - Atomic `findOneAndUpdate({ upsert: true, $inc: { count: 1 } })`.
  - On `E11000` (first-insert race) retries once.
  - If `count > limit` - `HttpException 429` with `code: RATE_LIMIT_EXCEEDED`, `limit` and `resetAt`.
- Limit: `AI_DAILY_LIMIT` (default 10).
- Read exposure **without** incrementing the counter: `AiResolver.aiUsageStatus` - `AiUsageStatusOutput { used, limit, remaining, resetAt }`.

## Retry / backoff

- **Only transient errors** are retried (`transient: true`): network (`E*`/`UND_ERR`), timeout (`ETIMEDOUT`/`ECONNABORTED`/msg timeout), 5xx, `429`, and **empty response** (`AI_EMPTY_RESPONSE`, includes reasoning models that exhaust their tokens).
- `AI_MAX_ATTEMPTS` attempts (default 3) within a **global budget** `AI_TOTAL_BUDGET_MS` (default 80000) shared between attempts + backoffs. If the budget is not enough, generation is abandoned.
- Backoff: `min(1000 * attempt, 4000) ms`; respects `Retry-After` (header or "try again in Xs/ms" message) on `429`.
- `maxRetries: 0` on the provider - full retry transparency lives in `AiService`.

### Empty response (EMPTY_RESPONSE)

Real problem: reasoning models can **exhaust the output budget during reasoning** and return empty `content` without raising an error. It is detected in `finalizeSuccess()`, classified as `AI_EMPTY_RESPONSE` (transient) and retried.

## Error taxonomy and auditing

`AI_CAUSE` (`ai-error-causes.ts`): `AI_PROVIDER_ERROR`, `AI_MALFORMED_JSON` (used by the training-plan parser), `AI_EMPTY_RESPONSE`, `AI_UNKNOWN_EXERCISE_NAME` (used by the materializer), `RATE_LIMIT_EXCEEDED`.

Each call records audit `AI_PROMPT_EXECUTED` (`success: true|false`) with metadata: `provider`, `modelUsed`, `durationMs`, `tokensUsed` (plus `cause`/`httpStatus`/`attempts` on failures).

## Configuration (env)

| Variable | Default | Description |
|---|---|---|
| `GROQ_API_KEY` | - | Groq API key |
| `PREFERRED_AI_PROVIDER` | `groq` | Provider used by `training-plan` |
| `AI_DAILY_LIMIT` | `10` | Max. AI calls per user/UTC day |
| `AI_CALL_TIMEOUT_MS` | `45000` | Timeout per attempt of the ChatGroq client |
| `AI_MAX_ATTEMPTS` | `3` | Total attempts on transient failures |
| `AI_TOTAL_BUDGET_MS` | `80000` | Global budget shared between attempts |
| `AI_MAX_OUTPUT_TOKENS` | `5000` | Output token budget (avoids empty content) |

## How to consume `AiService` from a new module

1. Import `AiModule` (it exports `AiService` and `AiRateLimitService`).
2. Inject `AiService`.
3. Build `systemPrompt` and `userPrompt` (LangChain messages).
4. Call `executePrompt({ providerName, systemPrompt, userPrompt, userId })`.
5. It returns `{ rawContent, modelUsed, promptUsed, tokensUsed }`; handle the `AI_CAUSE` codes as appropriate (e.g. parse with your own parser and raise `AI_MALFORMED_JSON` if the JSON is invalid).

> Usage detail in plan generation: `documents/modules/training-plan.md`.