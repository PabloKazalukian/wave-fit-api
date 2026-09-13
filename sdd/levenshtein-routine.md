# Levenshtein Name-Similarity Control for RoutineDay and RoutinePlan

> **Status:** Draft
> **Priority:** low

## Context

Name-similarity control exists today for `Exercise` (create/update): `ExerciseService` computes `normalizedName` via `normalizeString` and rejects names similar to existing ones using `isSimilar()` from `src/common/utils/string.utils.ts` (Levenshtein distance with `fastest-levenshtein`, bounded threshold, plus **opposite-keyword detection** via `containsOppositeKeywords` — push/pull, inclinado/declinado, barra/mancuerna, abd/add, etc. — to avoid false positives). Implemented in `src/modules/routines/templates/exercise/exercise.service.ts` (lines 51 and 109).

RoutineDay and RoutinePlan do not yet apply any similarity control to their names (`title` and `name` respectively): duplicate or near-duplicate titles/names are allowed. This Spec extends the existing control to both templates.

## Requirements

### Functional Requirements

- `FR-001` — `RoutineDayService.create` computes and persists a normalized `title` (via `normalizeString` from `src/common/utils/string.utils.ts`) and rejects the creation when `isSimilar(normalizedTitle, existing.normalizedTitle, 2)` matches any existing RoutineDay of the same creator, throwing `ConflictException`.
- `FR-002` — `RoutineDayService.update` recomputes the normalized title when `title` changes and applies the same similarity check against the creator's other RoutineDays (excluding itself), throwing `ConflictException` on match.
- `FR-003` — `RoutinePlanService.create` and `RoutinePlanService.update` behave identically for `name`, using `isSimilar(normalizedName, existing.normalizedName, 2)`.
- `FR-004` — Opposite-word detection is applied to both features: `containsOppositeKeywords(normalizedA, normalizedB)` returns `false`-similarity, so legitimate distinct names such as `Press inclinado` vs `Press declinado` or `Remo barra` vs `Remo mancuerna` are never blocked.
- `FR-005` — Exact duplicates are always rejected (a normalized match is a similarity match regardless of threshold).

### Business Rules

- `BR-001` — Similarity is scoped per creator (`createdBy` user): a title may collide with another user's titles (for shared/community templates this remains a deliberate, documented choice).
- `BR-002` — The user must be informed which existing title/name triggered the conflict, to rename or choose a distinct name.

### Non-Functional Requirements

- `NFR-001` — Reuse `normalizeString`, `singularizeToken`, `foldTokens`, `containsOppositeKeywords` and `isSimilar` from `src/common/utils/string.utils.ts`; do not duplicate matching logic.
- `NFR-002` — Use the same threshold convention as Exercise (`2` for `isSimilar`), keeping behavior consistent across the catalog and templates.
- `NFR-003` — The persisted normalized field must be kept in sync on every create/update of the name/title (mirror the Exercise `normalizedName` pattern).

## Constraints

- Do not change `src/common/utils/string.utils.ts` API; the utilities already cover the needed behavior (normalization, folding, opposite words).
- Do not apply the control to fields other than `title` (RoutineDay) and `name` (RoutinePlan); do not alter seeding/backfill behavior.
- Follow the exact rejection pattern of `ExerciseService` (locate existing documents filtered by creator and compare normalized values) without refactoring the exercise module.

## Architecture

Mirror the existing Exercise pattern; no new utilities or services are introduced:

```
RoutineDayService.create/update
   ├─ normalizeString(title) → normalizedTitle (persisted)
   └─ isSimilar(newNormalized, existing.normalizedTitle, 2) ──match──► ConflictException
RoutinePlanService.create/update
   ├─ normalizeString(name) → normalizedName (persisted)
   └─ isSimilar(newNormalized, existing.normalizedName, 2) ──match──► ConflictException
isSimilar internally: normalizeString + containsOppositeKeywords guard + distance() <= threshold
```

## Files

- `src/modules/routines/templates/routine-day/routine-day.service.ts` (modify: similarity check in create/update)
- `src/modules/routines/templates/routine-day/schema/routine-day.schema.ts` (modify: add `normalizedTitle`)
- `src/modules/routines/templates/routine-plan/routine-plan.service.ts` (modify: similarity check in create/update)
- `src/modules/routines/templates/routine-plan/schema/routine-plan.schema.ts` (modify: add `normalizedName`)
- `src/common/utils/string.utils.ts` (reference: existing `isSimilar`, `containsOppositeKeywords`)
- `src/modules/routines/templates/exercise/exercise.service.ts` (reference: canonical usage pattern, lines 51 and 109)

## Tests

- `TEST-001` — Unit: `src/modules/routines/templates/routine-day/routine-day.service.spec.ts` covers `ConflictException` on similar title create/update, success on distinct titles, self-exclusion on update, and normalization persistence.
- `TEST-002` — Unit: `src/modules/routines/templates/routine-plan/routine-plan.service.spec.ts` covers the same matrix for `name`.
- `TEST-003` — Unit: `src/common/utils/string.utils.spec.ts` already covers `isSimilar`/opposite words (reference; extend only if a new opposite pair is added).
- `TEST-004` — Full canonical gate: `npm run build`, `npm run lint`, `npm test`, `npm run test:e2e`.

## Acceptance Criteria

- `AC-001` — Creating or renaming a RoutineDay `title` that is equal (normalized) or similar (within threshold, no opposite words) to another title of the same creator is rejected with `ConflictException`.
- `AC-002` — The same applies to RoutinePlan `name`.
- `AC-003` — Legitimate distinct titles/names containing opposite keywords (e.g. `Press inclinado` vs `Press declinado`, `Remo barra` vs `Remo mancuerna`) are accepted.
- `AC-004` — `npm test` and `npm run lint` pass; no existing exercise, routine-day or routine-plan suite regresses.