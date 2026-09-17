# Plan — WorkoutSession.weekLogId nullable in GraphQL

> Status: Historical / Non-Authoritative (implemented and validated 2026-09-16)

## Problem

`WorkoutSession.weekLogId` was declared **non-nullable** in the GraphQL type
(`@Field(() => ID)` in `workout-session.entity.ts`), but the domain allows
sessions with no week-log:

- Mongo schema stores `weekLogId: Types.ObjectId | null` (`default: null`) —
  `workout-session.schema.ts:19-20`.
- Day-log sessions are created **without** a week-log: `update-day-log.use-case.ts:105`
  and `update-day-status.use-case.ts:50` call `WorkoutSessionService.create` with no
  `weekLogId`.

When the client completes a day (`updateWorkoutSession`) and selects `weekLogId`,
GraphQL raised:

```
Cannot return null for non-nullable field WorkoutSession.weekLogId.
```

Day-log and week-log are active **mutually exclusively** (spec `sdd/day-log.spec.md`
BR-001), so linking a day-log session to a week-log is wrong by design. The field
must be nullable.

## Tasks

1. `src/modules/routines/tracking/workout-session/entities/workout-session.entity.ts` —
   `@Field(() => ID, { nullable: true }) weekLogId?: string`.
2. Documentation: reflect nullable `weekLogId` for day-log sessions.
3. Validate: build, lint, unit tests, e2e tests.

## Validation

Covered by existing behavior (`weekLogId` optional in `CreateWorkoutSessionInput`),
existing service specs ("should create session without weekLogId" →
`weekLogId: null`), and the canonical gate.

## Outcome

Clients selecting `weekLogId` on a day-log session now receive `null` instead of a
500 `INTERNAL_SERVER_ERROR`. No change to the Mongo schema or persistence layer.