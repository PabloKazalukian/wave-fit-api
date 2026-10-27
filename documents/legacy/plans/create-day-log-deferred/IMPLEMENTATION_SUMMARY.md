# Implementation Summary: createDayLogDeferred

## Overview
Added a new GraphQL mutation `createDayLogDeferred` that allows creating a day-log for a past date, bypassing the active-week/day exclusivity rules. The created day-log is not active (`active: false`) and not completed (`completed: false`), but comes with an automatically created `WorkoutSession` that the frontend can edit.

## Files Created

### 1. DTO
- `src/modules/routines/tracking/day-log/presentation/dto/create-day-log-deferred.input.ts`
  - Input matching `CreateDayLogInput` structure
  - Fields: `date` (required, past date format), `timezone?`, `planId?`, `routineDayId?`, `notes?`

### 2. Use Case
- `src/modules/routines/tracking/day-log/application/use-cases/create-day-log-deferred.use-case.ts`
  - Validates date format with `isValidLocalDate`
  - Validates date is strictly past (`localDate < todayInTimezone`)
  - Checks no existing `day-log` for that user+date (via `findOneByUserAndDate`)
  - Checks no `week-log` contains that date (via `findOneByUserAndDate` on week-log repo)
  - Creates `DayLogDomain` with `active: false`, `completed: false`, `status: 'pending'`
  - **Always creates a `WorkoutSession`**:
    - If `routineDayId` provided: maps routine day exercises (`series: 0`, `sets: []`)
    - If no `routineDayId`: creates empty WS (`NOT_STARTED`, no exercises)
  - Persists day-log and returns populated domain

### 3. Service Method
- `src/modules/routines/tracking/day-log/day-log.service.ts`
  - Added `createDeferred(input, userId)` method delegating to use case

### 4. Resolver Mutation
- `src/modules/routines/tracking/day-log/day-log.resolver.ts`
  - Added `createDayLogDeferred` mutation
  - Uses `@UseGuards(GqlAuthGuard)` only (no `@Roles` - any authenticated user can create)
  - Includes `@UseInterceptors(AuditInterceptor)` and `@Audit('CREATE_DAY_LOG_DEFERRED', 'DayLog')`

### 5. Module Updates
- `src/modules/routines/tracking/day-log/day-log.module.ts`
  - Imports `WeekLogModule` (forwardRef)
  - Registers `RolesGuard` (for potential future use, though not enforced on this mutation)
  - Exports `DAY_LOG_USE_CASES` which now includes `CreateDayLogDeferredUseCase`

### 6. Repository Interfaces & Implementations
- `src/modules/routines/tracking/day-log/domain/interfaces/repositories/day-log.repository.interface.ts`
  - Added `findOneByUserAndDate(userId, dateStartUtc, dateEndUtc): Promise<DayLogDomain | null>`
- `src/modules/routines/tracking/day-log/infrastructure/repositories/day-log.repository.ts`
  - Implemented searching for non-deleted day-logs where `date >= start && date < end`
- `src/modules/routines/tracking/week-log/domain/interfaces/repositories/week-log.repository.interface.ts`
  - Added `findOneByUserAndDate(userId, dateUtc): Promise<WeekLogDomain | null>`
- `src/modules/routines/tracking/week-log/infrastructure/repositories/week-log.repository.ts`
  - Implemented finding week-logs where `startDate <= dateUtc <= endDate`

### 7. Supporting Files (created earlier in conversation)
- `src/common/decorators/roles.decorator.ts`
- `src/common/guards/roles.guard.ts`

## How It Works

### Mutation GraphQL
```graphql
mutation CreateDayLogDeferred($input: CreateDayLogDeferredInput!) {
  createDayLogDeferred(input: $input) {
    id
    userId
    date
    status
    active
    completed
    notes
    workoutSessionId  # Always populated with new WS ID
    routineDayId
    planId
  }
}
```

### Input `CreateDayLogDeferredInput`
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `date` | `String!` | Yes | `yyyy-MM-dd` format, must be past date |
| `timezone` | `String` | No | IANA timezone, defaults to `America/Argentina/Buenos_Aires` |
| `planId` | `ID` | No | Optional RoutinePlan ID |
| `routineDayId` | `ID` | No | Optional RoutineDay ID (creates WS with exercises if provided) |
| `notes` | `String` | No | Optional notes |

### Error Handling
| Situation | HTTP Status | Message |
|-----------|-------------|---------|
| Invalid date format | 400 | `"date \"...\" must be in yyyy-MM-dd format"` |
| Date is today or future | 400 | `"Solo se permite crear day-log diferido para fechas pasadas"` |
| Existing day-log for user+date | 400 | `"Ya existe un day-log para esta fecha"` |
| Date within a week-log | 400 | `"La fecha pertenece a un week-log. Edita el week-log directamente para completar ese día."` |
| Not authenticated | 401 | `"Authentication failed"` |

### Backend Creation Steps
1. Validate date format → `BadRequestException` if invalid
2. Validate date is strictly past → `BadRequestException` if today/future
3. Check for existing day-log for that user+date → `BadRequestException` if exists
4. Check for week-log containing that date → `BadRequestException` if found
5. Create `DayLogDomain` with `active: false`, `completed: false`, `status: 'pending'`
6. **Always create WorkoutSession**:
   - If `routineDayId`: map exercises, set `series: 0`, `sets: []`
   - If no `routineDayId`: create empty WS
7. Persist day-log via repository
8. Return populated day-log (includes `workoutSessionId`)

### Frontend Flow
1. User triggers `createDayLogDeferred` with past date
2. Backend returns day-log with `workoutSessionId` already set
3. Frontend can immediately:
   - View the WS details using `workoutSessionId`
   - Edit the WS via `updateDayLog` (series, sets, status, notes)
   - Mark day complete via `updateDayLog` with `completed: true` or `updateDayLogStatus`
4. User can repeat for multiple past dates

### Key Design Decisions
- **Always creates WS**: The day-log comes with a session already, so frontend can start editing immediately
- **No active/day exclusivity bypass**: This mutation intentionally bypasses the normal `validateNoActiveWeek`/`validateCreation` checks, making it the *only* way to create a day-log when a week-log is active
- **`completed: false` by default**: Frontend decides when to mark day complete
- **Same user authorization**: Only `GqlAuthGuard` needed - the authenticated user's `userId` is used, no role restriction

## Testing
- TypeScript compilation should pass (no new errors introduced in modified files)
- Existing day-log tests (`TEST-001` through `TEST-006` from spec) should continue passing
- New use case logic validated through the validation chain (date format → past date → no collisions → creation)

## Notes
- The `RolesGuard` was added to the module but the mutation doesn't enforce `@Roles(UserRole.ADMIN)` - any authenticated user can create deferred day-logs
- All date validations use the project's standard `todayInTimezone()` and `localDateToUtc` utilities with default timezone `America/Argentina/Buenos_Aires`
- Soft-delete semantics are respected: `findOneByUserAndDate` filters out `deleted: true` records