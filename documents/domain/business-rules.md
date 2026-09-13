> **Status:** Current
> **Last updated:** 2026-09-12

# Business Rules

Scope of this document: rules that are **stable and cross-feature** — they span aggregates, modules, or the whole API, and describe invariant behavior of the domain. Feature-specific requirements (exact inputs, output shapes, per-endpoint behavior) stay in the specs under `sdd/` and in the per-module documents; they are not duplicated here.

## Active-tracking exclusivity (hard rule)

A user can have exactly one active tracker at a time, chosen between `WeekLog` and `DayLog`:

- `WeekLogValidator.validateCreation` throws `ConflictException` (`'Already active day-log'`) if an active `DayLog` exists.
- `DayLogValidator.validateNoActiveWeek` throws `ConflictException` (`'Already active week-log'`) if an active `WeekLog` exists.
- Coordination lives in `ActiveTrackingService` (`hasActiveWeek`, `hasActiveDay`, `hasActiveTracking`), which is injected into both week-log and day-log — the two aggregates have no direct coupling.
- Related consequence: confirming a plan with action `create_week_log` fails with `409 Conflict` when the user already has an active week.

## Empty day becomes rest (soft input, hard normalization)

When a `days[]` array is submitted to `updateWeekLog` (or `updateWeekDay`), a day that arrives **without** a `workoutSession`, **without** an `extraSession`, and **with an empty** `workoutSessionId` (`""`) is treated by the backend as a day not worked:

- Any existing `WorkoutSession` for that day is removed.
- The day is forced to a rest day (`isRest: true`, `status: "skipped"`), regardless of the `status`/`isRest` values the client sent for it.
- A day with a worked `WorkoutSession` or with an assigned `ExtraSession` is **not** marked as rest.
- `workoutSessionId: ""` is accepted by the DTO (it does not fail `@IsMongoId`) to allow finalizing weeks that were not filled.

## One profile per user (1:1)

Each user has exactly one user profile. `upsertUserProfile` creates the profile or updates it when it already exists; `createUserProfile` is the 1-per-user creation path. The base profile and its sub-contexts are scoped to the authenticated `userId`.

## Soft delete in tracking

Tracking resources — `WorkoutSession`, `WeekLog`, and `DayLog` — are soft-deleted, not physically removed:

- Deletion flags the document (`deleted: true`) and records a `deletedAt` UTC timestamp.
- Reads exclude soft-deleted documents (queries include `deleted: { $ne: true }`).
- This is a cross-aggregate invariant of the tracking branch; templates (exercises, routine plans) follow their own removal semantics.

## `distributionDays` is a soft gate

The `distributionDays` preference (`week_log` default | `day_log`) only suggests the tracking type to the frontend:

- It does **not** block the creation of the other type.
- Legacy values (`'Week-log'`, `'Day-log'`, `'WEKK'`, `'DAY'`) are normalized once at bootstrap (idempotent backfill).
- It is included in the AI context (`buildUserContextForAI` → `ctx.distributionDays`).

## Ownership scoping

Tracking, profile, and training-plan operations are scoped to the authenticated user: queries filter by `userId` extracted from the JWT context, and operations such as `confirmPlan` only accept plans owned by the caller (`_id` + `userId`). Stats worker operations, by contrast, receive an explicit `userId` argument from the SQS message and are authenticated with a service JWT.