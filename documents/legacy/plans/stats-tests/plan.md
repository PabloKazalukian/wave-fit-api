# Plan: Pure Use-Case Unit Tests for Experimental Stats

> **Status:** Historical / Non-Authoritative
> **Executed on branch:** `feat/stats-experimental`
> **Spec:** `sdd/stats-tests.md`
> **Closed:** 2026-09-17 — implemented and validated; the current behavior is defined by the Spec (`status: done`) and the code.

## Status

**Implemented and archived.** Historical, non-authoritative. See the Spec `sdd/stats-tests.md` for the current contract.

**Date:** 2026-09-17
**Affected module:** `stats`

---

## 1. Current State

The `stats` module is experimental and has **0% coverage**: there are no
`.spec.ts` files under `src/modules/stats/`. It has 9 use cases in
`application/use-cases/`; this plan covers the **5 pure use cases** that can be
tested without touching production behavior:

- `save-top-exercises.use-case.ts`
- `save-top-routines.use-case.ts`
- `save-personal-records.use-case.ts`
- `save-adherence.use-case.ts`
- `get-raw-data-for-worker.use-case.ts`

## 2. Solution

Add one `.spec.ts` per pure use case following the mock patterns of
`documents/engineering/testing.md` section 6:

- `save-*`: mock the repository contract under the `STATS_REPOSITORY` token with
  `{ provide: STATS_REPOSITORY, useValue: { upsert*: jest.fn() } }`; assert
  domain mapping and call arguments.
- `get-raw-data-for-worker`: provide mocked mongoose models with
  `{ provide: getModelToken(X.name), useValue: modelMock }` (token by class name,
  not schema object name); mock the `.find(...).sort(...).lean().exec()` chain;
  assert per-model filters/sorts and the ObjectId → string field conversions.

No production file under `src/modules/stats/` is modified.

## 3. Tasks and Validation

| Task | File (new) | Validation |
|---|---|---|
| A1 | `save-top-exercises.use-case.spec.ts` | `npx jest --config jest.config.js src/modules/stats/application/use-cases/save-top-exercises.use-case.spec.ts` |
| A2 | `save-top-routines.use-case.spec.ts` | same, targeted file |
| A3 | `save-personal-records.use-case.spec.ts` | same, targeted file |
| A4 | `save-adherence.use-case.spec.ts` | same, targeted file |
| A5 | `get-raw-data-for-worker.use-case.spec.ts` | same, targeted file |
| A6 | — | `npx jest --config jest.config.js src/modules/stats` (all suites green) |

## 4. References

- Spec: `sdd/stats-tests.md`
- Mock patterns: `documents/engineering/testing.md` section 6
- Domain mapping: `src/modules/stats/domain/entities/stats.domain.ts`
- Repository token: `src/modules/stats/domain/interfaces/repositories/stats.repository.interface.ts`
- Reference schemas: `src/modules/stats/infrastructure/schemas/*-reference.schema.ts`

## 5. Next Steps

After this plan is implemented and validated, proceed to the DLQ/SQS publisher
work (`documents/plans/stats-dlq/plan.md`, spec `sdd/stats-dlq.md`). When the
feature is complete and the full gate passes, archive this plan to
`documents/legacy/plans/stats-tests/plan.md`.