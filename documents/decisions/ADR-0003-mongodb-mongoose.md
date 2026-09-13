> **Status:** Current
> **Last updated:** 2026-09-12

# ADR-0003: MongoDB with Mongoose

## Context

The domain is document-shaped: `WeekLog` embeds its seven days, sessions are referenced by ObjectId, and the user profile is a collection of optional sub-documents that grew over time (`goals`, `schedule`, `health-constraints`, `resource`, `strength-metrics`, `weight`, `training-preference`). A rigid relational schema would fight this evolution, and the project values fast iterative schema changes and an in-memory database for end-to-end tests.

## Decision

Use **MongoDB as the database and Mongoose as the ODM**. Documents model the aggregates directly, ObjectIds express references (`weekLogId`, `routineDayId`, `exerciseId`), and Mongoose schemas provide validation, indexes (including unique and TTL indexes), and `timestamps`.

## Engineering consequence: ObjectId casting

Mongoose 8 does **not** automatically cast a 24-hex-character string to `ObjectId` in every operation. The failure that motivated this lesson: sessions created via `insertMany(sessions)` with string `_id`s were stored as strings, so later queries built with `new Types.ObjectId(id)` did not match — the sessions became invisible (`WorkoutSession with ID "xxx" not found`), failing six E2E tests. (Historical fix record originally in `documents/fix.md`; that file was removed during the SDD documentation migration (2026-08-*, see `sdd/docs-migration.md`) — the lesson lives here.)

Lesson encoded in the codebase: when identifiers travel as strings from a domain layer, cast them explicitly with `new Types.ObjectId(...)` on writes and on all query methods (`insertMany`, `findOne`, `update`, `remove`, `findAllByUser`, `findByDate`) instead of assuming Mongoose will coerce them.

## Consequences

- **Positive:** schema flexibility for evolving aggregates; the expression of nested structures matches the domain; `mongodb-memory-server` makes E2E tests hermetic and fast; atomic operators (`findOneAndUpdate` with `$inc`/`upsert`) power high-concurrency features such as the AI rate-limit counter.
- **Negatives:** no native joins — references must be resolved in application code and careful population; implicit casting rules vary by Mongoose operation and version, as the ObjectId lesson shows; document-size and index discipline must be maintained as aggregates grow.

## Status

Accepted