> **Status:** Current
> **Last updated:** 2026-09-12

# ADR-0004: Hexagonal architecture for complex tracking modules

## Context

`WeekLog` and (later) `DayLog` are the most complex aggregates in the domain: they own and manage `WorkoutSession` and `ExtraSession` as sub-resources, implement hard business rules (active-tracking exclusivity, "empty day becomes rest"), and coordinate with other aggregates (`ActiveTrackingService`, routine plans). Implementing that logic directly on top of Mongoose schemas mixed business rules with persistence concerns, made unit testing depend on a database, and blurred which rules lived where. Simpler modules were fine with the classic `Resolver → Service → Schema` pattern.

## Decision

Use a 4-layer hexagonal (Clean Architecture) structure for the complex tracking modules:

| Layer | Directory | Responsibility | Depends on |
|---|---|---|---|
| Presentation | `presentation/` | GraphQL DTOs and output entities | — |
| Application | `application/use-cases/` | Use cases and validators | Domain (interface) |
| Domain | `domain/` | Domain entities and repository interfaces | — |
| Infrastructure | `infrastructure/` | Mongoose schemas and the repository implementation | Domain (interface) |

Dependency flow: `Resolver → Service → UseCase → Domain (interface) ← Infrastructure (implementation)`. The application layer depends on the domain interface, and the repository implementation (Mongoose) is injected behind it — the business rules never reference Mongoose directly.

Scope decision: `week-log` and `day-log` are fully hexagonal (all four layers, validator-driven rules, `ActiveTrackingService` injected for exclusivity), while the other modules keep the classic Resolver → Service → Schema pattern.

## Consequences

- **Positive:** use cases are unit-testable with interface mocks and no database; business rules (exclusivity, empty-day normalization) live in validators and use cases where they are visible and tested; swapping or mocking the persistence implementation is trivial; the pattern provides a consistent template for future complex modules (the AI training-plan module follows a comparable pipeline: validator → snapshot → prompt → parser → materializer → confirmation).
- **Negatives:** more files and indirection than the classic pattern; simple CRUD (templates, user) would be over-engineered with four layers, which is why the classic pattern remains for them; the migration is partial, so a reader must know which modules are hexagonal and which are not.

## Status

Accepted