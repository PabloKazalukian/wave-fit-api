# Plan: Day-Log `active` / `completed` / `status` semantics + `workoutSession` block in `updateDayLog`

> **Status:** Historical / Non-Authoritative
> **Spec:** `sdd/day-log.spec.md` (FR-004, FR-014, FR-015, BR-002, BR-003)
> **Executed on branch:** `feat/sdd`

## Context

The frontend needs to finish a day-log the same way a week-log day is finished: the workout session is saved and the day's display state is updated. The day-log already had `status`, `active` and `completed`, but their semantics were not documented as a contract, `updateDayLog` could not create the main `WorkoutSession`, and `completed` did not drive `status`.

## Agreed semantics (documented in `documents/domain/business-rules.md`)

| Concept | WeekLog | DayLog | Meaning |
|---|---|---|---|
| `active` | root | root | Current tracking resource (at most one). `completed = true` ⇒ `active = false`. |
| `completed` | root | root | Adherence: the user completed the training. |
| `status` | per `WeekLogDay` | on the day-log itself | Display state (`pending \| complete \| skipped`). |

Confirmed decisions:

- A rest day (`updateDayLogStatus isRest: true`) is `skipped` + `completed = false` but **keeps `active = true`** so the user can switch back to training.
- `updateDayLog` gains an optional `workoutSession` block (parity with `updateWeekDay`); `completed = true` guarantees a `WorkoutSession` exists (auto-created empty if missing).

## Tasks

1. **Spec** — `sdd/day-log.spec.md`: rewrite `FR-004`/`BR-002`/`BR-003`, add `FR-014` (workoutSession block + `completed → status='complete'` + ensured WS) and `FR-015` (rest/pending transitions).
2. **DTO** — `update-day-log.input.ts`: add `workoutSession?: UpdateWorkoutSessionInput`.
3. **Use case** — `update-day-log.use-case.ts`: `handleWorkoutSession` (create/update, `status='pending'`), `ensureWorkoutSession` on `completed: true`, `status='complete'` + `active=false`.
4. **Use cases** — `update-day-status.use-case.ts` and `remove-workout-session.use-case.ts`: force `completed=false`.
5. **Repository** — `IDayLogRepository.updateStatus` / `day-log.repository.ts`: optional `completed` parameter.
6. **Tests (first)** — unit for `update-day-log`, new `update-day-status` and `remove-workout-session` specs; e2e cases in `test/e2e/day-log/update-day-log.spec.ts`.
7. **Validation** — `npm run build`, `npm run lint`, `npm test`, `npm run test:e2e`.
8. **Documentation (after validation)** — `documents/domain/business-rules.md` (state semantics section), `documents/modules/day-log.md` (data model, API, tests, evolution).
9. **`status` is display-only (final corrected semantics)** — `UpdateDayLogInput.status: 'pending' | 'complete' | 'skipped'` is persisted verbatim and has **no side effects**: it never changes `completed`, `active` or the `WorkoutSession`, and the backend never infers it (no implicit `'pending'` from session blocks, no `'complete'` from `completed = true`). `completed = true` finalizes the day-log (`active = false`) and is independent from `status`. This aligns `DayLog` with the existing `WeekLog` behavior (`UpdateDayInput.status` is already a pure passthrough there).

## Validation result

- Build: OK.
- Lint: 0 errors (day-log files clean).
- Unit: 673 tests passed (day-log `update-day-log` suite 14).
- E2E: 169 tests passed (`update-day-log.spec.ts` 9).
