# Day-log (Standalone Training Day)

> **Status:** Done (implemented and validated)
> **Priority:** high

## Context

Users need to record a single training day **without a complete week** — ad-hoc sessions outside the weekly plan (WeekLog). The `day-log` module started as a NestJS CLI scaffold (placeholder use cases and `exampleField` DTOs). It is now **fully implemented**: a four-layer hexagonal module (`presentation` / `application` / `domain` / `infrastructure`) that coordinates with `ActiveTrackingService` to enforce uniqueness of the active tracking resource. The full contract is this document.

## Requirements

### Functional Requirements

- `FR-001` — A day-log is created and stored in a dedicated MongoDB collection `day_logs` with its own Mongoose schema (`DayLogSchema`); it never reuses the `WorkoutSession` collection as its primary store.
- `FR-002` — Day-log dates are captured as a **LocalDate** (`string` `"yyyy-MM-dd"`) in the input plus an optional `timezone` (default `'America/Argentina/Buenos_Aires'`) and converted to a **Date UTC** via `localDateToUtc` from `src/common/utils/date.utils`. Invalid dates are rejected with `isValidLocalDate`. Compare `week-log.domain.ts:153`.
- `FR-003` — A day-log holds an embedded exercises block with the same shape as `ExercisePerformance`/`SetPerformance` from workout-session (`exerciseId`, `series`, `sets[]`).
- `FR-004` — A day-log exposes a status lifecycle with enum values `pending | complete | skipped`, plus `active: boolean` (default `true`) and `completed: boolean` (default `false`) flags. `completed = true` forces `active = false`.
- `FR-005` — Removal is a **soft delete**: `removeDayLog` sets `deleted: true` and `deletedAt: now`; documents are never physically deleted and all read operations exclude soft-deleted documents.
- `FR-006` — **Exclusivity inside the resource**: a user can have at most one active day-log at a time. Creating a second one throws `ConflictException('Already active day-log')`.
- `FR-007` — **Cross-resource exclusivity (Fase C)**: creating a day-log while the user has an active week-log throws `ConflictException('Already active week-log')`. `DayLogValidator.validateNoActiveWeek` uses `ActiveTrackingService.hasActiveWeek`.
- `FR-008` — **ActiveTracking integration (Fase D)**: the unified read query `activeTracking` returns `{ hasActive, type: WEEK_LOG | DAY_LOG, week?, day? }`; `activeDayLog` returns `{ hasActiveDay, day }`. `ActiveTrackingModule` is imported by `DayLogModule`.
- `FR-009` — The day-log supports assignment of a template routine: `createDayLog(routineDayId)` and `assignRoutineToDayLog(routineDayId, date)` create an initial `WorkoutSession` with the routine day's exercises mapped (`series: 0`, `sets: []`).
- `FR-010` — `updateDayLog` accepts an optional `extraSession` block (same pattern as `updateWeekDay`): it resolves a `WorkoutSessionId` (existing day-log WS, client-provided WS validated to belong to the user, or a newly created empty WS), creates the `ExtraSession` linked to it, and appends the id to `extraSessionIds`.
- `FR-011` — Exposed GraphQL operations: `createDayLog`, `dayLogFindAll` (pagination `limit`/`offset`, default `limit: 5`), `dayLogFindOne`, `activeDayLog`, `updateDayLog`, `updateDayLogStatus(date, isRest)`, `assignRoutineToDayLog`, `removeWorkoutSessionFromDayLog`, `removeExtraSessionFromDayLog`, `removeDayLog`. All `id` arguments are `String` (never `Int`).
- `FR-012` — **Ownership isolation**: every operation filters/scopes by the authenticated `userId`; reading or mutating another user's day-log throws `ForbiddenException`; `dayLogFindOne` on a missing id throws `NotFoundException`.

### Business Rules

- `BR-001` — A user cannot have an active week-log and an active day-log simultaneously (hard write rule enforced by validators, not only by the front-end gate).
- `BR-002` — Completing a day (`completed = true`) closes it: `active` is forced to `false` regardless of any value sent by the client.
- `BR-003` — A day marked `skipped` (or a day-log with no workout and no extra session) represents a day not trained; it remains in history but is not an active training resource.

### Non-Functional Requirements

- `NFR-001` — Calendar dates are always stored in MongoDB as `Date` UTC; `Date.now()` is never used for calendar dates (only for `deletedAt`/timestamps).
- `NFR-002` — The default timezone matches the rest of tracking modules: `'America/Argentina/Buenos_Aires'` (`DEFAULT_TIMEZONE` in `day-log.service.ts`).
- `NFR-003` — The resolver is protected with `@UseGuards(GqlAuthGuard)` and mutations carry `@UseInterceptors(AuditInterceptor)` + `@Audit(...)` (actions `CREATE_DAY_LOG`, `UPDATE_DAY_LOG`, `UPDATE_DAY_LOG_STATUS`, `ASSIGN_ROUTINE_TO_DAY`, `REMOVE_WORKOUT_SESSION_FROM_DAY`, `REMOVE_EXTRA_SESSION_FROM_DAY`, `DELETE_DAY_LOG`).
- `NFR-004` — The module follows the four-layer hexagonal architecture of `week-log`; the repository maps Mongoose document ↔ `DayLogDomain` (ObjectId ↔ string) and is provided under token `DAY_LOG_REPOSITORY`.

## Constraints

- Do not reuse the `WorkoutSession` schema/collection as the day-log store; day-logs live in `day_logs`.
- Do not invent a new architecture: imitate `src/modules/routines/tracking/week-log/`.
- Do not introduce a physical delete path for day-logs.
- Do not create a second read API in parallel to `activeTracking`/`activeDayLog` for the same data; the deprecated `activeWeekLog` is a week-log concern in transition, not a day-log one.
- Shared exercise sub-schemas (`ExercisePerformanceSchema`, `SetPerformanceSchema`) come from workout-session; import them without forking.

## Architecture

Four-layer hexagonal module; the resolver never touches the repository directly — it delegates to `DayLogService`, which delegates to concrete use cases; the use cases depend only on the `IDayLogRepository` interface; the Mongoose repository implements it. Coordination with week-log happens through `ActiveTrackingService` (no direct coupling between use cases).

```
Resolver (GqlAuthGuard + AuditInterceptor)
   └─ DayLogService
        ├─ CreateDayLogUseCase          (LocalDate → UTC, exclusivity, optional routine WS)
        ├─ FindAllDayLogsUseCase        (userId scope, deleted:false, date desc, pagination)
        ├─ FindOneDayLogUseCase         (NotFound / Forbidden)
        ├─ FindActiveDayLogUseCase
        ├─ UpdateDayLogUseCase          (partial update, extraSession linkage)
        ├─ UpdateDayStatusUseCase       (status lifecycle)
        ├─ AssignRoutineDayUseCase
        ├─ RemoveWorkoutSessionUseCase
        ├─ RemoveExtraSessionUseCase
        └─ RemoveDayLogUseCase          (soft delete)
Domain: DayLogDomain + IDayLogRepository (DAY_LOG_REPOSITORY)
Infrastructure: DayLogSchema (day_logs) + DayLogRepository
Coordination: ActiveTrackingService (hasActiveWeek / hasActiveDay / hasActiveTracking)
```

## Files

- `src/modules/routines/tracking/day-log/day-log.module.ts`
- `src/modules/routines/tracking/day-log/day-log.service.ts`
- `src/modules/routines/tracking/day-log/day-log.resolver.ts`
- `src/modules/routines/tracking/day-log/day-log.resolver.types.ts` (`ActiveDayLogResponse`)
- `src/modules/routines/tracking/day-log/domain/entities/day-log.domain.ts` (`DayLogDomain`, `DayLogStatus = 'pending' | 'complete' | 'skipped'`)
- `src/modules/routines/tracking/day-log/domain/interfaces/repositories/day-log.repository.interface.ts` (`DAY_LOG_REPOSITORY`)
- `src/modules/routines/tracking/day-log/infrastructure/schemas/day-log.schema.ts` (`DayLogSchema`, indices `{ userId, date }`, `{ userId, active }`, `{ workoutSessionId }`, `{ extraSessionIds }`)
- `src/modules/routines/tracking/day-log/infrastructure/repositories/day-log.repository.ts`
- `src/modules/routines/tracking/day-log/application/validators/day-log.validator.ts`
- `src/modules/routines/tracking/day-log/application/use-cases/` — `create-day-log`, `find-all-day-logs`, `find-one-day-log`, `find-active-day-log`, `update-day-log`, `update-day-status`, `assign-routine-day`, `remove-day-log`, `remove-workout-session`, `remove-extra-session` (all `*.use-case.ts`, plus the barrel `index.ts`)
- `src/modules/routines/tracking/day-log/presentation/dto/{create-day-log.input.ts, update-day-log.input.ts, day-log-extra-session.input.ts}`
- `src/modules/routines/tracking/day-log/presentation/entities/day-log.entity.ts`
- `src/modules/routines/tracking/active-tracking/active-tracking.{module,service,resolver}.ts` (coordination)

## Tests

- `TEST-001` — Unit: `src/modules/routines/tracking/day-log/application/use-cases/create-day-log.use-case.spec.ts` covers LocalDate→UTC conversion (with/without timezone), invalid-date rejection, active-day and active-week exclusivity.
- `TEST-002` — Unit: `src/modules/routines/tracking/day-log/application/use-cases/update-day-log.use-case.spec.ts` covers partial update, ownership, `completed → active=false`, ExtraSession linkage.
- `TEST-003` — Unit: `src/modules/routines/tracking/day-log/application/validators/day-log.validator.spec.ts` covers date format, `'Already active day-log'` and `'Already active week-log'` conflicts, ownership.
- `TEST-004` — Unit: `src/modules/routines/tracking/day-log/day-log.service.spec.ts` and `day-log.resolver.spec.ts` cover delegation and guards/args.
- `TEST-005` — E2E: `test/e2e/day-log/` (create-day-log, crud, update-day-log, assign-routine, exclusivity, sessions, isolation) covers creation, exclusive active resource, routine assignment, WS/ES management, full CRUD, cross-user isolation and `activeTracking`.
- `TEST-006` — Full canonical gate green: `npm run build`, `npm run lint`, `npm test`, `npm run test:e2e`.

## Acceptance Criteria

- `AC-001` — A user can create, read, update, assign a routine to, add/remove WS and ExtraSessions on, and soft-delete a standalone day-log without any WeekLog.
- `AC-002` — A day-log and a week-log can never be active simultaneously for the same user, enforced with the documented `ConflictException` messages.
- `AC-003` — All stored dates are UTC; a LocalDate `"yyyy-MM-dd"` round-trips to the same local day in the default timezone.
- `AC-004` — Another user cannot observe or mutate a day-log that is not theirs.
- `AC-005` — `activeTracking` correctly reports `type: DAY_LOG` with the active day and `type: WEEK_LOG` with the active week (mutually exclusive).
- `AC-006` — The canonical verification workflow passes and the `test/e2e/day-log/` and day-log unit suites are green.