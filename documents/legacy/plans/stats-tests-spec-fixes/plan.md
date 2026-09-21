# Plan — Fix wording discrepancies in `sdd/stats-tests.md`

> **Status:** Historical / Non-Authoritative
> **Feature:** Spec accuracy (stats-tests)

## Context

Review of `sdd/stats-tests.md` (Status: done) found three wording discrepancies between the
Spec text and the implemented behavior/code:

1. **Context** claims the module is "outside the test suite (0% coverage)" even though this
   Spec itself adds the suites; the phrase should reflect the pre-Spec baseline.
2. **FR-005** says "`sets` → `reps`/`weights`"; the code keeps the `sets` field name and maps
   each element to `{ reps, weights }`.
3. **NFR-001** lists `EventEmitter2` and use-case `.execute()` mock patterns that do not apply
   to this Spec (no service/resolver layer is tested).

## Tasks

- [ ] Reword the `Context` 0%-coverage sentence.
- [ ] Fix `FR-005` field-conversion wording.
- [ ] Trim `NFR-001` to the mock patterns actually used.
- [ ] No code, test or behavior change; the suites already green.

## Validation

- Re-read `sdd/stats-tests.md`; the three statements must match the code and the suites.
- `git diff` shows only `sdd/stats-tests.md` changes.

## Notes

Archived as Historical / Non-Authoritative after execution.