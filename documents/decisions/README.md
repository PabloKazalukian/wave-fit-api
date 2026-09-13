> **Status:** Current
> **Last updated:** 2026-09-12

# Architecture Decision Records

Architecture Decision Records (ADRs) capture *why* a relevant engineering decision was made, the alternatives considered, and the consequences that followed. They are historical artifacts: they preserve reasoning even when the code evolves.

## Index

| ADR | Title | One-line topic |
|---|---|---|
| [ADR-0001](ADR-0001-jwt-http-only-cookie.md) | JWT in an HttpOnly cookie | The JWT travels in an HttpOnly cookie named `token` instead of an `Authorization: Bearer` header to mitigate XSS token theft. |
| [ADR-0002](ADR-0002-graphql-over-rest.md) | GraphQL over REST | The API is GraphQL (Apollo) instead of REST endpoints. |
| [ADR-0003](ADR-0003-mongodb-mongoose.md) | MongoDB and Mongoose | MongoDB with Mongoose as the data layer, including the ObjectId-casting lesson. |
| [ADR-0004](ADR-0004-hexagonal-tracking.md) | Hexagonal architecture for tracking | Complex tracking modules (week-log, day-log) use 4-layer hexagonal architecture with dependency inversion. |
| [ADR-0005](ADR-0005-google-oauth-pkce.md) | Google OAuth with PKCE | Google login uses the PKCE flow instead of less secure code exchange for SPA clients. |
| [ADR-0006](ADR-0006-ai-provider-strategy.md) | AI provider strategy | LLM access is centralized in the transversal `ai/` module with provider strategy, rate limit, and budgeted retries. |
| [ADR-0007](ADR-0007-stats-sqs-worker.md) | Stats delegated to an SQS worker | NestJS never computes statistics; an external worker does, driven by SQS events. |

## When is an ADR warranted?

An ADR exists to answer the question **"Why did we choose this?"** for a decision that:

- shapes the architecture or the API contract (data layer, API style, authentication strategy, module boundaries), or
- had meaningful alternatives with trade-offs (security, testability, operability), or
- produced a non-obvious engineering lesson that later work must not repeat.

Trivial implementation decisions — a choice of variable name, a one-line formatting rule, a local refactor without alternatives — do **not** get an ADR. If the choice does not constrain future work or cannot be revisited cheaply, it is not architectural.

Each ADR is structured as `Context` (the problem and alternatives), `Decision` (what was chosen and why), `Consequences` (what the choice costs and buys), and `Status`. A status other than `Accepted` marks a decision that was revisited or superseded.

## Related documents

- Domain concepts: [domain/overview.md](../domain/overview.md), [domain/glossary.md](../domain/glossary.md)
- Architecture: [engineering/architecture.md](../engineering/architecture.md)