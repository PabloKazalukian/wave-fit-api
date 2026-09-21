# Plan — Training History Calendar: Full Extra Sessions

> **Status:** Historical / Non-Authoritative
> **Authoring date:** 2026-09-21
> **Spec:** `sdd/training-history.spec.md` (done)
> **Parent plan:** `documents/legacy/plans/training-history/plan.md` (archived)
> **Executed on branch:** `feat/training-history-calendar`
> **Closed:** 2026-09-21 — implemented and validated; the current behavior is defined by the Spec (`status: done`) and the code.
> **NOTE:** Plans are never authoritative. This follow-up extends the implemented `trainingCalendar` contract with full `ExtraSession` objects; the Spec (`done`) and the code are the source of truth.

## Decision (user clarification)

The frontend needs the calendar rows to render the day's extra-sessions directly. The user chose:

> **Carry full `ExtraSession` objects** (`extraSessions: [ExtraSession]`) on every `CalendarDay`, keeping `extraSessionIds`.

Alternatives considered and rejected: (a) ids-only as-is (no payload change) — rejected because the frontend cannot render without a second query; (b) replace `extraSessionIds` with objects — rejected because `extraSessionIds` is part of the already-merged WEEK_LOG-only contract in `main`.

## Current State

`CalendarDay` already carries `extraSessionIds` (id-only) for both `WEEK_LOG` days (from `.populate('days.extraSessionIds')`) and `DAY_LOG` entries (`training-history.service.ts:92-94`, `:111-113`). Gaps:

1. The `DayLog` query does **not** populate `extraSessionIds`.
2. The response never carries the full `ExtraSession` objects (schema: `category, date, discipline, duration, intensityLevel, calories?, notes?`; entity `ExtraSession` already exists in `extra-session/entities/extra-session.entity.ts`).
3. No unit or e2e test exercises non-empty extra sessions (e2e seeds `extraSessionIds: []`).
4. `training-history.module.ts` does not register `ExtraSessionSchema` (it was dropped as an "unused" `forFeature` entry in the `DAY_LOG` commit).

## Tasks

### T1 — Spec

Update `sdd/training-history.spec.md`: extend `FR-007` (new `extraSessions` field), diagram (`DayLog` populate + `extraSessions`), Files section, `TEST-001`/`TEST-002`/`TEST-006`, new `AC-006`, and reword the old "Do not add extra populate for the DAY_LOG path" constraint. **DONE.**

### T2 — Plan

This file. Active/Pending until archived at the end.

### T3 — Tests (RED)

- Unit (`training-history.service.spec.ts`): extend `TEST-001` and `TEST-002` so the mocked `extraSessionIds` entries are full schema-shaped `ExtraSession` docs; assert `extraSessions` holds the mapped objects (id, category, discipline, duration, intensityLevel, calories/notes passthrough) for both entry types. Extend the `dayLogQuery` mock with `.populate(...).mockReturnThis()`.
- E2E (`test/e2e/training-history/training-calendar.spec.ts`):
  - Add `extraSessions { id discipline duration intensityLevel category calories notes }` to `CALENDAR_QUERY`.
  - Seed two real `ExtraSession` docs: one linked to `wsWeek` and attached to week day `2026-01-01` (`extraSessionIds`), one linked to `wsDay` and attached to the day-log (`extraSessionIds`).
  - Assert full objects on the `2026-01-01` (`WEEK_LOG`) and `2026-01-15` (`DAY_LOG`) rows.
  - Note: the new `extraSessions` field reference fails GraphQL schema validation until the entity is updated → RED.

### T4 — Implementation

- Entity (`training-history.entity.ts`): import `ExtraSession`; `@Field(() => [ExtraSession])` `extraSessions?: ExtraSession[]` on `CalendarDay`.
- Service (`training-history.service.ts`): add `.populate('extraSessionIds')` to the `DayLog` query; add private `mapExtraSession(doc): ExtraSession` (schema doc → entity, tolerating `_id`/field shapes; skip non-materialized entries); set `extraSessions` in both branches (default `[]` when none / only populated docs materialize).
- Module (`training-history.module.ts`): re-register `ExtraSession.name/ExtraSessionSchema` in `forFeature`; drop only `WorkoutSession`.

### T5/T6 — Validation (targeted → canonical gate)

- Targeted: `npm run test <unit spec>` + `npm run test:e2e <calendar spec path>`.
- Canonical gate: `npm run build` → `npm run lint` → `npm test` → `npm run test:e2e`.

### T7 — Closure

- Final spec pass; commit on `feat/training-history-calendar`; push; provide PR URL (push to `main` rejected / `gh` unauthenticated → URL to the user).
- Archive this plan to `documents/legacy/plans/training-history-extra-sessions/plan.md` (Historical / Non-Authoritative) and update `documents/plans/README.md` index.
- Give the user the query/mutation snippets for everything built.

## Files

- `src/modules/routines/tracking/training-history/presentation/entities/training-history.entity.ts`
- `src/modules/routines/tracking/training-history/training-history.service.ts`
- `src/modules/routines/tracking/training-history/training-history.module.ts`
- `src/modules/routines/tracking/training-history/training-history.service.spec.ts`
- `test/e2e/training-history/training-calendar.spec.ts`
- `sdd/training-history.spec.md`
- `documents/plans/README.md` (index update on archive)