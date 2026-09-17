# Day-Log Module — Standalone Training Day

> Part of the stable module documentation. Specs live under `sdd/`; this document describes the implemented system state.
> **Status:** Current
> **Last updated:** 2026-09-16

> **Feature contract:** `sdd/day-log.spec.md`.

> **Twins:** the `day-log` and `training-plan` modules are the two ways a user can track a training block: a standalone day (`day-log`) or an AI weekly plan (`training-plan`). Their contracts stay aligned (error taxonomy, timezone rules, ownership). See `documents/modules/training-plan.md` for the AI twin.

## Purpose

A day-log is a **standalone training day** — an ad-hoc session recorded **without a complete week** (outside the WeekLog). It owns a `WorkoutSession` (its `workoutSessionId`) plus optional `ExtraSession`s (`extraSessionIds[]`), and it can import a template routine day. The active-tracking exclusivity rule guarantees a user has **at most one** active tracking resource: either an active `week-log` or an active `day-log`, never both.

## Module layout (four-layer hexagonal)

```
src/modules/routines/tracking/day-log/
├── day-log.module.ts            # Wiring (imports ActiveTrackingModule)
├── day-log.service.ts           # Facade + DEFAULT_TIMEZONE + delegating to use cases
├── day-log.resolver.ts          # GraphQL mutations/queries (GqlAuthGuard + AuditInterceptor)
├── day-log.resolver.types.ts    # ActiveDayLogResponse { hasActiveDay, day }
├── domain/
│   ├── entities/day-log.domain.ts        # DayLogDomain + DayLogStatus (pending|complete|skipped)
│   └── interfaces/repositories/day-log.repository.interface.ts  # DAY_LOG_REPOSITORY
├── infrastructure/
│   ├── schemas/day-log.schema.ts         # DayLogSchema (collection daylogs; soft delete)
│   └── repositories/day-log.repository.ts
├── application/
│   ├── validators/day-log.validator.ts   # validateCreation / validateOwnership / validateNoActiveWeek
│   └── use-cases/                         # 10 use cases (one per service operation)
└── presentation/
    ├── dto/{create-day-log.input.ts, update-day-log.input.ts, day-log-extra-session.input.ts}
    └── entities/day-log.entity.ts
```

The resolver never touches the repository; it delegates to `DayLogService`, which delegates to concrete use cases. Crossing coordination with week-log happens only through `ActiveTrackingService` (no direct coupling between use cases).

## Data model

- Stored in the MongoDB collection **`daylogs`** (auto-named by the Mongoose tracking convention — same as `weeklogs`, `routinedays`, `workoutsessions`; it is **not** `day_logs`).
- `DayLogSchema` indices: `{ userId, date }`, `{ userId, active }`, `{ workoutSessionId }`, `{ extraSessionIds }`.
- Embedded exercises block reuses `ExercisePerformance`/`SetPerformance` shapes from workout-session (`exerciseId`, `series`, `sets[]`).
- Status lifecycle: `pending | complete | skipped`; flags `active` (default `true`) and `completed` (default `false`). Semantics (see `documents/domain/business-rules.md` → *Tracking state semantics*): `active` marks the current tracker, `completed` finalizes the day-log, `status` is a **display-only** field owned by the frontend. Completing (`completed = true`) forces `active = false` and ensures a `WorkoutSession` exists (auto-created empty if missing); it does **not** modify `status`. The backend never infers `status` (not from `completed`, not from session blocks). A rest day (via the dedicated `updateDayLogStatus`) is `skipped` + `completed = false` but stays `active = true` so it can be switched back to training.
- **Soft delete:** `removeDayLog` sets `deleted: true` + `deletedAt: now`; documents are never physically deleted and all reads exclude soft-deleted documents.

## Calendar and timezone rules

- Inputs carry a **LocalDate** `"yyyy-MM-dd"` and an **optional** IANA `timezone`; dates are stored in MongoDB as **Date UTC** via `localDateToUtc` (`src/common/utils/date.utils.ts`).
- Missing timezone falls back to `'America/Argentina/Buenos_Aires'` (`DEFAULT_TIMEZONE`, declared in `day-log.service.ts`, `create-day-log.use-case.ts` and `update-day-log.use-case.ts`).
- `Date.now()` is never used for calendar dates (only for `deletedAt`/timestamps).

## Error contract (aligned with the training-plan twin)

- **400 `BAD_REQUEST`** — invalid date (regex-invalid *or* semantically invalid, e.g. `2025-02-31`) in `createDayLog` / `updateDayLogStatus`.
- **404 `NOT_FOUND`** — `updateDayLog`/`removeDayLog` on a nonexistent or unowned id; `dayLogFindOne` on a missing id.
- **403 `FORBIDDEN`** — ownership isolation on another user's day-log.
- **409 `CONFLICT`** — `'Already active day-log'` (second active day) and `'Already active week-log'` (active week exists).
- No use case falls back to a generic `Error`; all failures map to `HttpException`.

## GraphQL API

```
DayLog:
  createDayLog(createDayLogInput: CreateDayLogInput) -> DayLog
  dayLogFindAll(limit: Number = 5, offset: Number = 0) -> [DayLog]   # array, NOT a page (twin contrast: trainingPlans -> TrainingPlanPage)
  dayLogFindOne(id: String!) -> DayLog
  activeDayLog -> ActiveDayLogResponse { hasActiveDay, day }
  updateDayLog(input: UpdateDayLogInput) -> DayLog
  updateDayLogStatus(date: String!, isRest: Boolean!) -> DayLog
  assignRoutineToDayLog(routineDayId: String!, date: String!) -> DayLog
  removeWorkoutSessionFromDayLog(workoutSessionId: String!) -> DayLog
  removeExtraSessionFromDayLog(extraSessionId: String!) -> DayLog
  removeDayLog(id: String!) -> DayLog
```

- All operations are user-scoped (`GqlAuthGuard`) and mutations carry `@Audit(...)` (actions `CREATE_DAY_LOG`, `UPDATE_DAY_LOG`, `UPDATE_DAY_LOG_STATUS`, `ASSIGN_ROUTINE_TO_DAY`, `REMOVE_WORKOUT_SESSION_FROM_DAY`, `REMOVE_EXTRA_SESSION_FROM_DAY`, `DELETE_DAY_LOG`).
- `UpdateDayLogInput` fields: `id`, `notes`, `timezone`, `active`, `completed`, `status`, `workoutSessionId`, `workoutSession` (create/update the main session — parity with `updateWeekDay`) and `extraSession`.
- `status` is a display-only field (parity with week-log's per-day `status`): an explicit `status` (`pending | complete | skipped`) is persisted verbatim with **no side effects** — it does not touch `completed`, `active` or the linked `WorkoutSession`, and the backend never infers it. Closing the day-log is `completed = true` (forces `active = false`). Marking a day as rest is the dedicated `updateDayLogStatus(date, isRest: true)` mutation.
- `id` arguments are `String`, never `Int`.

## Active tracking coordination

- `activeDayLog` → `{ hasActiveDay, day }`; if no active day, `{ hasActiveDay: false }`.
- `activeTracking` (from `ActiveTrackingModule`) → `{ hasActive, type: WEEK_LOG | DAY_LOG, week?, day? }` — mutually exclusive by design.
- Rules enforced in validators (not only the front-end gate): at most one active day-log (`ConflictException`), and no day-log while an active week exists.

## Exercises and ExtraSessions

- `createDayLog(routineDayId)` and `assignRoutineToDayLog` create the initial `WorkoutSession` mapping the routine day's exercises (`series: 0`, `sets: []`).
- `updateDayLog` accepts an optional `workoutSession` block (same `UpdateWorkoutSessionInput` shape as `updateWeekDay`): when the day-log already has a `workoutSessionId` the session is updated (a mismatching explicit `workoutSession.id` throws `BadRequestException`), otherwise a new `WorkoutSession` is created with the `dayLogId` back-reference. Session blocks do **not** change `status` (display-only). When `completed = true` the use case guarantees a session exists before setting `completed = true` and `active = false` (it does not touch `status`).
- `updateDayLog` with an `extraSession` block resolves the target `WorkoutSession` by priority: `dayLog.workoutSessionId` → client-provided `workoutSessionId` (validated to belong to the user) → newly created empty WS. It then creates the `ExtraSession` and appends its id to `extraSessionIds`.
- `updateDayLogStatus(isRest: true)` sets `status = 'skipped'`, removes the linked `WorkoutSession` and forces `completed = false`, keeping `active = true`; `isRest: false` sets `status = 'pending'`, forces `completed = false` and creates/reuses the session. `removeWorkoutSessionFromDayLog` likewise forces `completed = false` + `status = 'pending'`.
- WorkoutSessions owned by a day-log store a **back-reference `dayLogId`** to the owning day-log (mirror of `weekLogId` for week-log sessions) and `weekLogId: null`. The GraphQL fields `WorkoutSession.dayLogId` and `WorkoutSession.weekLogId` are **nullable** — a session only carries the id of the aggregate it belongs to, never an error.
- `WorkoutSessionService.create` validates `dayLogId` ownership exactly like `weekLogId` (NotFoundException if missing/unowned); therefore `createDayLog` persists the day-log before creating its initial session. Existing sessions were backfilled by migration `005-backfill-day-log-id`.

## Tests

- Unit: use-case suites under `src/modules/routines/tracking/day-log/` (`create-day-log`, `update-day-log`, `update-day-status`, `remove-workout-session`, validators, service, resolver) — covering UTC conversion (with/without timezone), `BadRequestException`/`NotFoundException` error contract, exclusivity, `completed → active=false` + ensured WS (no `status` inference), the display-only `status` passthrough, the `workoutSession` block (create vs update), rest/pending transitions and session linkage.
- E2E: `test/e2e/day-log/` (create-day-log, crud, update-day-log, assign-routine, exclusivity, sessions, isolation) — 35 tests covering full CRUD, exclusive active resource, WS/ES management, `status`/`completed` lifecycle, cross-user isolation, `activeTracking` and the aligned error contract (`NOT_FOUND`/`BAD_REQUEST` extensions).
- Canonical gate: `npm run build`, `npm run lint`, `npm test`, `npm run test:e2e`.

## Status and evolution

| Scenario | Status |
|---|---|
| Standalone day tracking (hexagonal) | Current |
| Error contract aligned with training-plan twin | Current (2026-09-14) |
| `timezone` optional in create | Current (2026-09-14) |
| `WorkoutSession.dayLogId` back-reference + nullable `weekLogId`/`dayLogId` | Current (2026-09-16) |
| `completed` finalizes the day-log; `status` is a display-only front field (no inference) + `workoutSession` block in `updateDayLog` | Current (2026-09-16) |
| DayLog as AI confirmation artifact | Future (training-plan roadmap) |

## Known limitations and technical debt

- Dead code in `day-log.repository.ts`: `delete()`, `findRaw()`, `findActiveRaw()` have no call sites in `src/` (only `updateStatus` is used) — left untouched.
- `updateDayStatus(date, isRest)` validates `date` but operates on the **active** day (`findActive(userId)`); the `date` parameter is not used to locate the day.
- `dayLogFindAll` returns a plain array (limit/offset without `total`/`pages`) — intentionally not a `DayLogPage` (twin asymmetry with `TrainingPlanPage` is a documented decision).