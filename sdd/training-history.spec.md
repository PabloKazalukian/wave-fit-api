# Training History Calendar

> **Status:** done
> **Priority:** medium

## Context

The `trainingCalendar` query already exists in `main` (commit `099ccf9`, 2026-08-18) and returns a read-only monthly calendar over the user tracking history. Today it only covers **WeekLog days** (`WEEK_LOG` entries): `TrainingHistoryService.getTrainingCalendar` queries `WeekLog` documents overlapping the month, maps each in-range `WeekLogDay` to a `CalendarDay`, and sorts by local date. The `DayLog` capability (`DayType.DAY_LOG`) is declared in the entity but **never emitted**, `CalendarDay` has no `dayLogId`, and there are **no tests** (neither unit nor e2e) for the module.

`DayLog` documents (`day-log.schema.ts`) carry a single `date` (Date UTC), a display `status` (`pending | complete | skipped`), `workoutSessionId` and `extraSessionIds` — the data needed to emit `DAY_LOG` entries already exists.

This Spec extends the existing contract: add `DAY_LOG` emissions with `dayLogId`, keep the query name, the `Date` UTC fields of `WeekLogReference` and the four-status enum (`pending | complete | skipped | rest` — there is no `none`). It distills `documents/plans/training-history/plan.md` into an executable contract. **Implemented and validated 2026-09-21** (`feat/training-history-calendar`); the plan was archived to `documents/legacy/plans/training-history/plan.md`.

## Requirements

### Functional Requirements

- `FR-001` — The GraphQL query `trainingCalendar(input: TrainingCalendarInput)` returns `TrainingCalendarResponse { year, month, days }`. `TrainingCalendarInput` is `{ year: Int!, month: Int!, timezone?: String }` (`src/modules/routines/tracking/training-history/presentation/dto/training-calendar.input.ts`). The query name stays `trainingCalendar` (as referenced in `documents/engineering/architecture.md` and `documents/domain/overview.md`); `GET_TRAINING_CALENDAR` is a frontend operation alias, not a backend identifier.
- `FR-002` — The month window is derived with the same logic as the current service: `rangeStartUtc = localDateToUtc(`${year}-${pad(month)}-01`, timezone)` and `rangeEndUtc = localDateToUtc(firstDayOfNextMonthLocalDate, timezone)`. UTX boundaries are the local start-of-day for the first day of the month and the first day of the next month.
- `FR-003` — `WEEK_LOG` entries: query `WeekLog` where `{ userId, deleted: { $ne: true }, startDate: { $lt: rangeEndUtc }, endDate: { $gte: rangeStartUtc } }` (existing predicate), and emit one `CalendarDay` per `WeekLogDay` whose local date falls inside `[monthStart, monthEndLocal]`.
- `FR-004` — `DAY_LOG` entries: query `DayLog` where `{ userId, deleted: { $ne: true }, date: { $gte: rangeStartUtc, $lt: rangeEndUtc } }` and emit one `CalendarDay` per document with `type: DayType.DAY_LOG` and `dayLogId` set to the day-log id.
- `FR-005` — Status mapping: for `WEEK_LOG`, `TrainingStatus.REST` when `day.isRest`, otherwise the stored per-day `status` (`pending | complete | skipped`) passed through as `'pending' | 'complete' | 'skipped'`. For `DAY_LOG`, the stored status is passed through unchanged. `CalendarDay.status` is a **plain string** (`@Field()`), so the GraphQL wire format is the lowercase value `'pending' | 'complete' | 'skipped' | 'rest'` — matching the day-log/week-log `status` convention. This is a deliberate contract decision: the earlier WEEK_LOG-only implementation serialized the `TrainingStatus` GraphQL enum name (`'PENDING'`, `'COMPLETE'`, `'SKIPPED'`, `'REST'`); the frontend draft contract requires the lowercase values. The `TrainingStatus` enum keeps the lowercase values in the service. The enum value `none` is **not** part of the contract.
- `FR-006` — `CalendarDay.date` is the local date as string `yyyy-MM-dd` (`LocalDate`), produced with `utcToLocalDate(date, timezone)` for both entry types.
- `FR-007` — `workoutSessionId` and `extraSessionIds` on `CalendarDay`: for `WEEK_LOG`, resolved from the day's populated references (existing `resolveId` logic); for `DAY_LOG`, resolved from `dayLog.workoutSessionId` / `dayLog.extraSessionIds`.
- `FR-008` — `weekLogReference` is exposed **only** on `WEEK_LOG` entries: `{ id, startDate, endDate, completed, active, notes? }`, with `startDate`/`endDate` as the stored `Date` (UTC), exactly as `WeekLogReference` declares. `DAY_LOG` entries have `weekLogReference: null`.
- `FR-009` — `timezone` is optional and defaults to `'America/Argentina/Buenos_Aires'` (`DEFAULT_TIMEZONE` in `training-history.service.ts`, matching the day-log module).
- `FR-010` — The response `days` array is sorted ascending by `CalendarDay.date` (`'yyyy-MM-dd'` string comparison), mixing both entry types.
- `FR-011` — Input validation returns `400 BAD_REQUEST` for `month` outside `[1, 12]`, `year <= 0`, or an invalid IANA `timezone`.

### Business Rules

- `BR-001` — Soft-deleted resources are never included: both the `WeekLog` and the `DayLog` queries exclude `deleted: { $ne: true }`.
- `BR-002` — A calendar day is backed by at most one entry: a `DAY_LOG` and a `WEEK_LOG` day can share a local date (a past week-log plus a later standalone day-log); on collision the `WEEK_LOG` entry wins and the `DAY_LOG` entry is not emitted.
- `BR-003` — The backend never infers the display `status` (aligned with `documents/domain/business-rules.md` → *Tracking state semantics*): statuses are stored values passed through; the only derivation is `rest` from the week-log day `isRest` flag.

### Non-Functional Requirements

- `NFR-001` — The module keeps its current three-file shape (module/service/resolver + DTO/entity); **no** four-layer hexagonal refactor.
- `NFR-002` — Code identifiers, enum values and file paths written in this Spec match the sources exactly (`DayType`, `TrainingStatus`, `CalendarDay`, `WeekLogReference`, `TrainingCalendarResponse`, `dayLogId`).
- `NFR-003` — No application behavior outside `src/modules/routines/tracking/training-history/` changes: `week-log`, `day-log`, resolvers and data model of those aggregates stay untouched.
- `NFR-004` — This module is in the production test gate (unlike the experimental `stats` module): unit tests live beside the module and e2e tests under `test/e2e/training-history/`, all covered by the canonical workflow.

## Constraints

- Do **not** add a `none` status to `TrainingStatus`.
- Do **not** rename the query; keep `trainingCalendar`.
- Do **not** change `WeekLogReference.startDate`/`endDate` from `Date` (UTC) to `LocalDate` strings.
- Do **not** add mutations; `trainingCalendar` remains read-only (existing `GqlAuthGuard` + `extractUserId`).
- Do **not** modify `week-log`, `day-log`, `workout-session` or `extra-session` modules or their schemas.
- Do **not** add extra `populate` for the `DAY_LOG` path (the ids on the day-log document are already present).

## Architecture

```
trainingCalendar(input: { year, month, timezone? })
    ↓  extractUserId(context) → userId  (GqlAuthGuard)
TrainingHistoryService.getTrainingCalendar(userId, year, month, timezone)
    ↓  rangeStartUtc / rangeEndUtc  (localDateToUtc + addDaysToLocalDate, DEFAULT_TIMEZONE fallback)
┌──────────────────────────────────────────────────────────────────┐
│ WeekLog  [{userId, deleted:{$ne:true}, startDate<rangeEnd,        │
│            endDate>=rangeStart}]  .populate(workoutSessionId,     │
│                                      extraSessionIds)             │
│   → per in-range WeekLogDay: CalendarDay { type: WEEK_LOG,        │
│        date: utcToLocalDate, status: isRest→REST | day.status,    │
│        workoutSessionId, extraSessionIds, weekLogReference }      │
├──────────────────────────────────────────────────────────────────┤
│ DayLog  [{userId, deleted:{$ne:true}, date: [rangeStart,           │
│            rangeEnd)}]                                            │
│   → per document: CalendarDay { type: DAY_LOG, date:              │
│        utcToLocalDate, status: dayLog.status, workoutSessionId,   │
│        extraSessionIds, dayLogId }                                │
└──────────────────────────────────────────────────────────────────┘
    ↓  merge (BR-002: WEEK_LOG wins on date collision)
    ↓  sort ascending by date  (FR-010)
TrainingCalendarResponse { year, month, days }
```

## Files

- `src/modules/routines/tracking/training-history/training-history.service.ts` (modify: inject `DayLog` model, validation per `FR-011`, `DAY_LOG` query + merge per `FR-004`/`BR-002`)
- `src/modules/routines/tracking/training-history/presentation/entities/training-history.entity.ts` (modify: add `dayLogId?: string` — `@Field(() => ID, { nullable: true })` — to `CalendarDay`)
- `src/modules/routines/tracking/training-history/training-history.module.ts` (modify: register `DayLog` schema; drop the unused `WorkoutSession`/`ExtraSession` `forFeature` entries)
- `src/modules/routines/tracking/training-history/training-history.service.spec.ts` (new: unit tests, see `TEST-001`..`TEST-005`)
- `test/e2e/training-history/training-calendar.spec.ts` (new: e2e, see `TEST-006`/`TEST-007`; follow the patterns of `test/e2e/day-log/crud.spec.ts` and the helpers in `test/e2e/helpers/`)
- `src/modules/routines/tracking/day-log/infrastructure/schemas/day-log.schema.ts` (reference: `DayLog` fields/queries, not modified)
- `src/modules/routines/tracking/workout-session/schema/workout-session.schema.ts` (reference: `WorkoutSession.dayLogId`/`weekLogId`, not modified)

## Tests

- `TEST-001` — Unit (`training-history.service.spec.ts`): `WEEK_LOG` mapping — `isRest` day → `rest`; `pending | complete | skipped` passed through; in-range vs out-of-range days; `workoutSessionId`/`extraSessionIds` resolved after populate; `weekLogReference` populated with `Date` fields. Proves `FR-003`, `FR-005`, `FR-006`, `FR-007`, `FR-008`, `BR-003`.
- `TEST-002` — Unit: `DAY_LOG` mapping — `type: DAY_LOG`, `dayLogId` set, status passed through `pending | complete | skipped`, session ids resolved, `weekLogReference` null. Proves `FR-004`, `FR-005`, `FR-006`, `FR-007`, `FR-008`.
- `TEST-003` — Unit: month window and timezone boundaries — UTC range derived with and without an explicit timezone; a `WeekLog` overlapping the month edge and a `DayLog` at `rangeEndUtc` boundary are excluded correctly. Proves `FR-002`, `FR-006`, `FR-009`.
- `TEST-004` — Unit: merge, sort and precedence — mixed entries are merged and sorted ascending by local date; on a date collision the `DAY_LOG` entry is dropped. Proves `FR-010`, `BR-002`.
- `TEST-005` — Unit: input validation — `month` 0/13, `year` 0 and an invalid `timezone` reject with `400 BAD_REQUEST`. Proves `FR-011`.
- `TEST-006` — E2E (`test/e2e/training-history/training-calendar.spec.ts`): seed a `WeekLog` and a `DayLog` in the same month for the authenticated user and assert the response returns the expected `WEEK_LOG` + `DAY_LOG` calendar days sorted by date with the documented shapes. Proves `FR-001`, `FR-003`, `FR-004`, `FR-006`, `FR-010`.
- `TEST-007` — E2E: soft-deleted `WeekLog`/`DayLog` are excluded; another user's data is not visible (isolation); invalid input returns `400`. Proves `BR-001`, `FR-011`, `NFR-003`.

## Acceptance Criteria

- `AC-001` — `trainingCalendar` returns a single month of `CalendarDay` entries covering both `WEEK_LOG` and `DAY_LOG` sources, sorted ascending by local date.
- `AC-002` — `DAY_LOG` entries expose `dayLogId` with a null `weekLogReference`; `WEEK_LOG` entries expose `weekLogReference` with `Date` (UTC) `startDate`/`endDate` and no `dayLogId`.
- `AC-003` — `CalendarDay.status` values, as returned by GraphQL, are limited to the lowercase strings `pending | complete | skipped | rest`; `none` is never returned.
- `AC-004` — Soft-deleted resources and other users' resources never appear; invalid month/year/timezone inputs reject with `400 BAD_REQUEST`.
- `AC-005` — The canonical verification workflow passes: `npm run build`, `npm run lint`, `npm test`, `npm run test:e2e`.