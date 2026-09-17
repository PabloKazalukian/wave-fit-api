# Plan: Implement Day-Log + centralized active-activity layer (`activeTracking`) + activation of `distributionDays`

> **Status:** Historical / Non-Authoritative
> **Spec:** `sdd/day-log.spec.md`
> **Executed on branch:** `feat/day-log`

## Status

Approved as an implementation plan (dated 2026-08-29) and **implemented in full** on branch `feat/day-log` (backend); the frontend was worked on a parallel branch in another repository. The authoritative contract for this feature is now the Spec `sdd/day-log.spec.md`. This plan is kept for traceability and historical review only.

---

## 1. Context and key finding

The **`distributionDays`** field already exists **dormant** in the UserProfile schema:

`src/modules/user/user-profile/schema/user-profile.schema.ts`

```ts
export enum DistributionDays {
  WEKK = 'Week-log',     // <-- typo: WEKK, values in PascalCase with dash
  DAY  = 'Day-log',
}
...
@Prop({ type: String, enum: DistributionDays, default: DistributionDays.WEKK })
distributionDays: DistributionDays;
```

It is **schema-level only**. It is NOT exposed in:
- the GraphQL entity (`entities/user-profile.entity.ts`),
- the DTOs (`create-user-profile.input.ts`, `update-user-profile.input.ts`),
- the service (`user-profile.service.ts`) — it is neither read nor written,
- the AI context (`buildUserContextForAI()` in `user-profile.utils.ts`),
- any tracking module.

It is the natural entry point for the user to choose between **week-log** (weekly plan) and **day-log** (standalone day).

---

## 2. Source of truth for "what is active" — current state (backend)

Today the activity query lives **inside week-log**:

- `week-log.resolver.ts:76` → `@Query activeWeekLog` → `ActiveWeekLogResponse { hasActiveWeek: boolean, week?: WeekLog }`.
- `week-log.resolver.ts:89` → `@Query currentWorkoutSession` → returns the same active week (misleading alias: it does not bring a session, it brings the active week-log).
- Internally: `weekLogService.findActiveWeekLog(userId)` → `FindActiveWeekLogUseCase` → `repository.findActive(userId)` (searches `{userId, active:true, deleted:{$ne:true}}`).

**Consequences today:**
- Only the **active week** notion exists. There is no layer for day-log (not yet implemented).
- The frontend today: queries `activeWeekLog` to know whether there is an active week, and **cancels/finalizes** it directly by calling week-log mutations (`updateWeekLog` with `completed=true`, or `removeWeekLog`).
- The "active" record is **dispersed** in each tracking module (week-log knows its own `active`), not centralized.

---

## 3. Objective and redesign

1. Activate `distributionDays` in user-profile (default / soft gate).
2. Implement the complete **day-log** module with hexagonal architecture (4 layers), replicating the **WorkoutSession / ExtraSession** orchestration as sub-resources (week-log pattern).
3. **Active-uniqueness rule**: creating a week-log OR a day-log requires that **nothing else is active** (neither the same value nor the other).
4. **Read/write separation** for the source of truth of activity:
   - **Write** (create / activate / cancel / finalize): goes directly to week-log / day-log (the frontend uses the `type` + `id` from the unified query to know which module to touch).
   - **Read** ("what is active?"): moves to a **new unified layer** `activeTracking` that queries both repositories and returns **DL or WL**.

### Read-layer contract (Phase D)

```graphql
enum TrackingType { WEEK_LOG DAY_LOG }

type ActiveTracking {
  hasActive: Boolean!
  type: TrackingType        # WEEK_LOG | DAY_LOG | null
  week: WeekLog             # present if type = WEEK_LOG
  day:  DayLog              # present if type = DAY_LOG
}

type Query {
  activeTracking: ActiveTracking!   # replaces (with transition) activeWeekLog
}
```

- `ActiveTrackingService` injects `WEEK_LOG_REPOSITORY` + `DAY_LOG_REPOSITORY`, queries `findActive` on both and builds the DTO.
- **Write does not change**: the frontend cancels/finalizes against the correct module according to `activeTracking.type`.

---

## 4. Agreed design decisions

| Decision | Choice |
|----------|--------|
| **Entry point** | Activate the existing `distributionDays` (do not migrate it to training-preference). |
| **DayLog document shape** | **No `days[]` array**: a single `workoutSessionId`, `extraSessionIds[]` and `status` on the root (a standalone day = one main session). |
| **Operation scope** | create / findAll / findOne / update / remove + assignRoutineToDayLog + updateDayLogStatus + removeWorkoutSessionFromDayLog + removeExtraSessionFromDayLog. Active equivalent: `findActiveDayLog`. No `syncWeekLogDays`. |
| **`distributionDays` as a gate** | **Soft gate**: default preference in the frontend; **never blocks** the creation of the other type. The only hard rule is active uniqueness. |
| **Active uniqueness** | Creating a week-log or a day-log requires nothing else active (neither the same nor the other). `ConflictException` if there is one. |
| **Read layer** | Unified `activeTracking` (Phase D). |
| **`activeWeekLog` / `currentWorkoutSession`** | **Keep deprecated during the transition**; the frontend (new branch) migrates to `activeTracking`; they are removed in a later iteration. |
| **`WEKK` typo normalization** | To be confirmed at implementation: normalize to `WEEK` (snake_case values `'week_log'`/`'day_log'`) with read compatibility for existing docs is proposed. Alternative: activate without renaming. |

---

## 5. Branch strategy (git)

- **Backend:** branch **`feat/day-log`** (created from `langchain`). The current branch remains intact and functional.
- **Frontend (other repo):** parallel branch to migrate to the new API:
  - Read/expose `distributionDays` and use it as the default for the type to create (with flexibility to choose).
  - Migrate the activity query from `activeWeekLog` → `activeTracking`.
  - Use `activeTracking.type`/`id` to cancel against the correct module.

---

## 6. Phase structure

> Incremental: each phase can be validated/merged separately.

### PHASE A — Activate `distributionDays` in UserProfile

**Files:**
- `schema/user-profile.schema.ts` — decide normalization of the typo/values (see §4).
- `entities/user-profile.entity.ts` — expose `distributionDays` (GraphQL `ObjectType`).
- `dto/create-user-profile.input.ts`, `dto/update-user-profile.input.ts` — add validated field (enum / `IsIn`).
- `service/user-profile.service.ts` — read/write `distributionDays` in create/update/upsert.
- `user-profile.utils.ts` (`buildUserContextForAI`) — include `distributionDays` in the AI context.
- Data migration if values are normalized.

**Acceptance criterion:** `updateUserProfile`/`upsertUserProfile` can set and read `distributionDays`; the frontend can query it.

---

### PHASE B — Implement the Day-Log module (operational, hexagonal)

#### B.1 `infrastructure/schemas/day-log.schema.ts`
Single-day model (no array):

```ts
@Schema({ timestamps: true })
class DayLog {
  userId: ObjectId ref User          // required, index
  date: Date                         // UTC, required
  planId?: ObjectId ref RoutinePlan  // default null
  routineDayId?: ObjectId ref RoutineDay // optional (if it comes from a routine)
  workoutSessionId?: ObjectId ref WorkoutSession  // nullable (ref, not embedded)
  extraSessionIds: ObjectId[] ref ExtraSession    // default []
  status: enum ['pending','complete','skipped']   // default 'pending'
  active: boolean                    // default true, index
  completed: boolean                 // default false
  notes?: string                     // default ''
  deleted: boolean                   // default false
  deletedAt?: Date
}
// Indexes: {userId,date}, {userId,active}, {workoutSessionId}, {extraSessionIds}
```

References to WS/ES by ObjectId (same mechanism as week-log: `populate('workoutSessionId')` / `populate('extraSessionIds')`).

#### B.2 `domain/`
- `entities/day-log.domain.ts` — `DayLogDomain` (getters/setters for `status`, `active`, `workoutSessionId`, `extraSessionIds`, `notes`) + factory that, given a plan/routine, generates `WorkoutSessionCreationData` (analogous to `WeekLogDomain.createFromPlan`).
- `interfaces/repositories/day-log.repository.interface.ts` — token `DAY_LOG_REPOSITORY` + `IDayLogRepository` (findOne, findAllByUser, findActive, create, updateDayField, updateStatus, findRaw, findByIdAndSoftDelete, delete).

#### B.3 `infrastructure/repositories/day-log.repository.ts`
Implementation with populate + `mapToDomain` (`week-log.repository.ts` pattern).

#### B.4 `application/use-cases/` (replace the 5 stubs)
- `create-day-log.use-case` — validates date/ownership, checks **internal exclusivity** (no active day-log) and (in Phase C) **cross exclusivity** (no active week); builds the domain, creates the WS via `WorkoutSessionService` when applicable, persists the ref. Expected signature: `execute(input, userId)`.
- `find-all-day-logs.use-case` / `find-one-day-log.use-case`.
- `update-day-log.use-case` — updates `notes`/`active`/`completed` + optional WS/ES (same `processDay` mechanism of week-log).
- `remove-day-log.use-case` — soft delete.
- `update-day-status.use-case` — equivalent to `updateWeekDayWorkoutStatus` (isRest → `skipped` + deletes WS; active → `pending` + creates/cleans WS).
- `assign-routine-day.use-case` — loads `RoutineDay`, builds the exercises, creates/updates the day's WS.
- `remove-workout-session.use-case` / `remove-extra-session.use-case` — remove the ref from the day-log and delete the real doc.
- `day-log.validator.ts` — `validateCreation` (date + exclusivity), `validateOwnership` (already written), `validateUpdate`.
- Update `application/use-cases/index.ts` (`DAY_LOG_USE_CASES`).

#### B.5 `service/day-log.service.ts`
Orchestrator (like `WeekLogService`): injects repository + use cases + `WorkoutSessionService`/`ExtraSessionService`/`RoutineDayService`. Each public method delegates to a use case and returns the domain. Exposes `findActiveDayLog`.

#### B.6 `day-log.module.ts`
- `MongooseModule.forFeature([DayLog, WorkoutSession])`.
- Import `AuditLogsModule`, `WorkoutSessionModule`, `ExtraSessionModule`, `RoutineDayModule` (`forwardRef` where needed for cycles).
- Providers: `DayLogResolver`, `DayLogService`, `DayLogValidator`, `...DAY_LOG_USE_CASES`, `{ provide: DAY_LOG_REPOSITORY, useClass: DayLogRepository }`.
- Export `DAY_LOG_REPOSITORY` and `DayLogService` (consumed by the Phase C/D layer).

#### B.7 `day-log.resolver.ts` (rewrite)
- Add **`@UseGuards(GqlAuthGuard)`** and **`@UseInterceptors(AuditInterceptor)`** (current gap).
- Extract `userId` from `@Context()`. Use `Types.ObjectId` instead of `Int` for ids.
- Operations (keep `dayLogFindAll`/`dayLogFindOne`):
  - `createDayLog(input)` → `DayLog`
  - `dayLogFindAll` / `dayLogFindOne(id)` → with ownership
  - `updateDayLog(input)`, `removeDayLog(id)`
  - `assignRoutineToDayLog(routineDayId, date)`, `updateDayLogStatus(date, isRest)`, `removeWorkoutSessionFromDayLog(workoutSessionId)`, `removeExtraSessionFromDayLog(extraSessionId)`
- `@Audit(...)` decorators on mutations (CREATE/UPDATE/DELETE/ASSIGN_DAY_LOG).

#### B.8 Real DTOs / Entity
Replace `exampleField` in `create-day-log.input.ts`, `update-day-log.input.ts`, `entities/day-log.entity.ts`.

#### B.9 Tests
- Specs: service, resolver, validator, use cases (week-log mock patterns).
- E2E (`test/e2e/day-log/`): auth+ownership, creation with WS/ES, internal exclusivity, CRUD.
- Phase B close: full test suite green (`npm test` + `npm run test:e2e`).

**Acceptance criterion:** day-log functional, with auth and audit; WS/ES are created/updated/deleted exactly as in week-log.

---

### PHASE C — Active uniqueness (hard write rule)

1. **Coordination service** `ActiveTrackingService` (same service that Phase D will expose): injects `WEEK_LOG_REPOSITORY` + `DAY_LOG_REPOSITORY` and exposes `hasActiveWeek(userId)`, `hasActiveDay(userId)`, `hasActiveTracking(userId)`.
2. Inject it in:
   - `WeekLogValidator.validateCreation` → when creating a week, if there is an **active day** → `ConflictException('Already active day-log')`.
   - `DayLogValidator.validateCreation` → when creating a day, if there is an **active week** → `ConflictException('Already active week-log')`.
3. Respect the existing pattern: completing a record forces `active=false` (like `updateWeekLog` with `completed===true`).
4. Avoid direct week↔day coupling: the coordination lives in the shared service (injected by token in both modules), without circular `forwardRef` between week-log and day-log.

**Acceptance criterion:** a week and a day cannot be active simultaneously; creating the second one throws `ConflictException`.

---

### PHASE D — Unified read layer `activeTracking`

1. Define the `TrackingType` enum + `ActiveTracking` `ObjectType` (see contract in §3).
2. Expose `@Query activeTracking` in a resolver of the layer (e.g. `active-tracking`).
3. `ActiveTrackingService` queries `findActive` on both repos and builds the DTO (`hasActive`, `type`, `week?`, `day?`).
4. **Transition**: `activeWeekLog`/`currentWorkoutSession` stay **deprecated** (not removed in this iteration); the frontend migrates to `activeTracking`.
5. Audit/guard: apply the pattern of the rest of tracking (`GqlAuthGuard`).

**Acceptance criterion:** `activeTracking` returns the active record (WEEK_LOG or DAY_LOG) or `hasActive=false`; it replaces `activeWeekLog` for the frontend.

---

## 7. Technical considerations / risks

- **Guard missing today**: the current day-log resolver is not protected and returns strings → add `GqlAuthGuard` + real types (Phase B).
- **`WEKK` typo**: normalizing requires migrating docs that already have `'Week-log'` by default (see §4).
- **GraphQL collisions**: respect the `<entity><Verb>` convention; do not introduce duplicate names. `activeTracking` does not collide with `activeWeekLog` (both will exist during the transition).
- **Audit**: `@Audit` on all day-log mutations.
- **forwardRef**: week-log ↔ WorkoutSession already uses `forwardRef`; day-log replicates that pattern. Phase C/D injects both repos into `ActiveTrackingService` without creating a week↔day cycle.
- **Tests**: replicate patterns (unit + e2e). Coverage at the close of each phase.

---

## 8. Out of scope

- Frontend (other repo): not touched from this plan, but the API change (the `distributionDays` field, day-log operations, `activeTracking` query) is documented for synchronization.
- `syncWeekLogDays`: no equivalent in day-log (one day = one session).
- Final removal of `activeWeekLog`/`currentWorkoutSession` → later iteration.
- Migrating the field to `training-preference`: discarded (the existing `distributionDays` in user-profile is activated).

---

## 9. Reference documents

- `src/modules/routines/tracking/week-log/` — reference architecture (domain/repository/use-cases/validator/service/module).
- `documents/modules/user-profile.md` — bounded-contexts.
- `documents/engineering/testing.md` — mock and e2e patterns.
- `sdd/day-log.spec.md` — the completed feature contract.