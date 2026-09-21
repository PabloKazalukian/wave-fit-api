# Plan — Training History Calendar

> **Status:** Historical / Non-Authoritative
> **Authoring date:** 2026-09-21
> **Spec:** `sdd/training-history.spec.md` (done)
> **Executed on branch:** `feat/training-history-calendar`
> **Closed:** 2026-09-21 — implemented and validated; the current behavior is defined by the Spec (`status: done`) and the code.
> **NOTE:** Plans are never authoritative. This plan describes the path (and the user decisions) for implementing the Spec; the Spec + Code are the source of truth once implemented. On completion this plan is archived to `documents/legacy/plans/training-history/plan.md` and marked Historical / Non-Authoritative.

## Goal

Extend the existing `trainingCalendar` query (already on `main`, commit `099ccf9`) to the full contract defined in `sdd/training-history.md`: add `DAY_LOG` calendar entries with `dayLogId`, keep the four-status `TrainingStatus` without `none`, keep the `Date` (UTC) `WeekLogReference` fields and the `trainingCalendar` query name, and add the missing unit + e2e test coverage.

## User-confirmed decisions

| # | Decision | Impact |
|---|----------|--------|
| D-1 | Drop `none` from `TrainingStatus` | Enum stays `pending \| complete \| skipped \| rest`; spec `FR-005`/`AC-003`. |
| D-2 | Keep the query name `trainingCalendar` | No rename; `GET_TRAINING_CALENDAR` documented as frontend alias only; spec `FR-001`. |
| D-3 | Keep `WeekLogReference.startDate`/`endDate` as `Date` (UTC) | No LocalDate-string migration of these fields; spec `FR-008`. |
| D-4 | Minimal patch (no hexagonal refactor) | Keep the 3-file module shape; spec `NFR-001`. |

## Research findings (applied)

- `training-history.module.ts` registers `WorkoutSession`/`ExtraSession` schemas in `forFeature` but the service **never injects them** — they are dead entries; replace them with the `DayLog` schema import (`day-log/infrastructure/schemas/day-log.schema.ts`).
- `training-history.service.ts` already implements the month-window math, `mapDayStatus` (rest derivation) and `resolveId`; the `DAY_LOG` path, `dayLogId`, validation and merge/sort of both sources are the missing pieces.
- `day-log.schema.ts` stores `date` (Date UTC), status `pending|complete|skipped`, `workoutSessionId`, `extraSessionIds` — enough to emit `DAY_LOG` entries without populates.
- No unit or e2e tests exist for the module today. E2E patterns to mirror: `test/e2e/day-log/crud.spec.ts` (superTest + `AppTestModule` + `createTestUser` + `getCookieWithToken`), helpers in `test/e2e/helpers/day-log.helper.ts` / `week-log.helper.ts`.

## Tasks (test-first)

- **T1 — Tests, unit (red):** write `src/modules/routines/tracking/training-history/training-history.service.spec.ts` covering spec `TEST-001`..`TEST-005` (WEEK_LOG mapping, DAY_LOG mapping, window/timezone boundaries, merge/sort/precedence, validation). They fail because the service has no `DayLog` query, no `dayLogId` and no validation.
- **T2 — Tests, e2e (red):** write `test/e2e/training-history/training-calendar.spec.ts` covering spec `TEST-006`/`TEST-007` (mixed calendar, soft-delete exclusion, isolation, `400` on invalid input), seeding a `WeekLog` and a `DayLog` in one month for the authenticated user.
- **T3 — Entity:** add `dayLogId?: string` (`@Field(() => ID, { nullable: true })`) to `CalendarDay` in `presentation/entities/training-history.entity.ts`.
- **T4 — Service:** in `training-history.service.ts` inject the `DayLog` model, validate input (`FR-011`: `month ∈ [1,12]`, `year > 0`, valid IANA timezone → `BadRequestException`), query in-range `DayLog` documents (`{ userId, deleted: { $ne: true }, date: { $gte: rangeStartUtc, $lt: rangeEndUtc } }`), map them to `DAY_LOG` entries, merge with `WEEK_LOG` entries (precedence `WEEK_LOG` on date collision), and keep the ascending sort.
- **T5 — Module:** register `DayLog` in `forFeature` and remove the unused `WorkoutSession`/`ExtraSession` registrations.
- **T6 — Targeted validation:** `npx jest --config jest.config.js src/modules/routines/tracking/training-history` and `npx jest --config ./test/jest-e2e.json test/e2e/training-history` green.
- **T7 — Canonical gate:** `npm run build`, `npm run lint`, `npm test`, `npm run test:e2e` all green in the whole repository.
- **T8 — Docs (only after validation):** update `documents/domain/overview.md` (calendar line: add `DAY_LOG` + `dayLogId` coverage) and `documents/engineering/architecture.md` `TrainingHistory: trainingCalendar` line if needed; promote the spec: rename `sdd/training-history.md` → `sdd/training-history.spec.md`, set status `done`, update the `sdd/README.md` Backlog row.
- **T9 — Archive + PR:** move this plan to `documents/legacy/plans/training-history/plan.md`, mark Historical / Non-Authoritative, update the `documents/plans/README.md` index; create branch `feat/training-history-calendar` from `origin/main` and open a PR (manual — `gh` is not authenticated; direct push to `main` is rejected by repo rules).

## Validation commands

```bash
npx jest --config jest.config.js src/modules/routines/tracking/training-history
npx jest --config ./test/jest-e2e.json test/e2e/training-history
npm run build
npm run lint
npm test
npm run test:e2e
```

## Risks / notes

- The 3-file module stays as-is; a future hexagonal refactor is out of scope (D-4) and would be a separate plan.
- `WeekLogReference.startDate/endDate` stay `Date`; do not "improve" them to LocalDate while implementing (D-3).
- The e2e auth flow mirrors `day-log`/`week-log` suites (`getCookieWithToken` + `createTestUser`).