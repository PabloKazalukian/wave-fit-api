> **Status:** Current
> **Last updated:** 2026-09-12

# ADR-0002: GraphQL over REST

## Context

The domain is inherently nested: a week contains days which contain sessions (`WeekLog` → `days[]` → `WorkoutSession`/`ExtraSession`), and a user profile aggregates up to eight sub-contexts. A REST API would need either many endpoints, eager over-fetching payloads, or dozens of request round-trips to assemble these aggregates. The clients are a web SPA and a mobile app, both of which need to query only the fields they render.

## Decision

Expose the API as **GraphQL (Apollo Server / NestJS)** instead of REST:

- A single `/graphql` endpoint; the schema is auto-generated from TypeScript definitions (`autoSchemaFile: true`).
- Clients query exactly the fields they need, including nested aggregates in one round-trip.
- Input validation is done with `class-validator` on DTOs.
- The Playground is enabled in development.
- All resolvers receive `{ req, res }` in the context, which is what makes the cookie-based auth (ADR-0001) workable at the resolver level.

A consequence discovered in practice: GraphQL merges all operations into one schema, so operation names must be globally unique. The tracking `findAll`/`findOne` operations collided across modules (`workoutSession`, `extraSession`, `dayLog`) and were renamed with `name` overrides (`workoutSessionFindAll/FindOne`, `extraSessionFindAll/FindOne`, `dayLogFindAll/FindOne`).

## Consequences

- **Positive:** one contract for all clients; nested queries without N+1 endpoints; schema introspection for free; no versioned REST surface to maintain.
- **Negatives:** a matching layer (resolvers + DTOs + entities) must be maintained for each operation; authorization must be enforced per-resolver (`@UseGuards`), not per-endpoint; operation-name collisions are possible, as seen with the tracking modules.

## Status

Accepted