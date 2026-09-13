> **Status:** Current
> **Last updated:** 2026-09-12

# ADR-0006: AI provider strategy

## Context

The training-plan feature calls an LLM to generate plans. A direct, ad-hoc integration had three risks: (1) the plan module would be coupled to one vendor SDK; (2) each consumer would re-implement retries, quotas, and auditing with different semantics; (3) naive retrying can burn a provider budget and there was no per-user limit, so one user could exhaust the plan quota. The decision had to keep the generation modules (currently `training-plan`) isolated from any concrete LLM provider.

## Decision

Centralize all LLM access in a **transversal `ai/` module** as the only entry point, and make providers pluggable:

- **Single choke point:** `AiService.executePrompt({ providerName, systemPrompt, userPrompt, userId })` is the only path that calls the LLM. It applies rate limit → provider resolution → message building → retry loop with budget → audit in one place.
- **Strategy pattern:** providers are registered in a `Map` under the injection token `'AI_PROVIDERS'`, each implementing `IAiProvider` (`name` + `getModel()`). Today there is one provider, `GroqProvider` (`openai/gpt-oss-120b`, `temperature: 0`); adding a provider means implementing the interface and registering it.
- **Rate limit:** per-user daily fixed window (UTC) over the `ai_usage` collection (unique index on `userId + windowStart`, TTL 2 days, `AI_DAILY_LIMIT` default 10). A 429 with `RATE_LIMIT_EXCEEDED` is returned once the limit is reached.
- **Retries with budget:** only transient errors are retried (network, timeout, 5xx, 429, empty response) up to `AI_MAX_ATTEMPTS` (default 3) within a shared `AI_TOTAL_BUDGET_MS` (default 80000). The Groq client is configured with `maxRetries: 0` so the only retry layer lives in `AiService`.
- **Auditability:** every call records an `AuditLog` (`AI_PROMPT_EXECUTED`) with provider, model, duration, tokens, and error cause; failures are tagged with the `AI_CAUSE` taxonomy.

## Consequences

- **Positive:** generation modules depend on a stable service contract, not on a vendor SDK; quota enforcement and audit are guaranteed for every consumer; switching or adding providers is a registration change, and the generation pipeline (validator → snapshot → prompt → parse → materialize) shells out through one call.
- **Negatives:** a transversal layer adds a dependency for every AI consumer; the rate limit is per-user in-memory/Mongo but module-level idempotency locks are in-memory only (single-node valid); the strategy is only as provider-agnostic as the model options each provider accepts.

## Status

Accepted