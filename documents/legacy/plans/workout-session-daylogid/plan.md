# Plan — WorkoutSession.dayLogId back-reference

> Status: Historical / Non-Authoritative (implemented and validated 2026-09-16)

## Problem

`WorkoutSession` stored a `weekLogId` back-reference for week-log sessions but
nothing for day-log sessions. The `DayLog` held the forward reference
(`workoutSessionId`) while the session did not know its owning day-log, so the
relation was not queryable from the session side and the two aggregates were not
symmetric.

## Decision

Add a nullable `dayLogId` back-reference to `WorkoutSession`, mirroring
`weekLogId`:

- Mongo: `dayLogId: Types.ObjectId | null` (`ref: 'DayLog'`, `default: null`) +
  index `{ dayLogId: 1 }`.
- GraphQL: `WorkoutSession.dayLogId: ID` nullable; `CreateWorkoutSessionInput.dayLogId?`
  optional (update input inherits it via `PartialType`).
- `WorkoutSessionService.create` validates `dayLogId` ownership exactly like
  `weekLogId` (NotFoundException if missing/unowned). This required injecting
  `DayLogService` with `forwardRef` and importing `forwardRef(() => DayLogModule)`
  in `WorkoutSessionModule` (bidirectional NestJS cycle, both sides forwardRef).
- `createDayLog` now persists the day-log **before** creating its initial
  `WorkoutSession`, so the ownership validation finds the document.
- Every day-log session-creation path passes `dayLogId`: `createDayLog`,
  `assignRoutineToDayLog` (create + backfill-on-touch of an existing session),
  `updateDayLog` (empty WS), `updateDayLogStatus` (empty WS).
- `WorkoutSessionService.insertMany` maps the optional `dayLogId`.

## Tasks

1. Schema + GraphQL entity + input DTO.
2. Service validation/persistence + module wiring.
3. Day-log use cases.
4. Backfill migration `005-backfill-day-log-id` (+ npm script) and
   `normalize-ids.ts` id field.
5. Stats `WorkoutSession` reference schema.
6. Tests (service, resolver, day-log use cases).
7. Documentation.

## Out of scope

`ExtraSessionService` auto-creating a `WorkoutSession` when no
`workoutSessionId` is provided has no day-log context; it keeps
`weekLogId: null` / `dayLogId: null`.

## Outcome

Day-log sessions now carry `dayLogId` (and `weekLogId: null`); week-log sessions
carry `weekLogId` (and `dayLogId: null`). Existing sessions were backfilled from
`daylogs.workoutSessionId`.
