# Plan — Promote `stats-tests` to `sdd/stats-tests.spec.md`

> **Status:** Historical / Non-Authoritative
> **Feature:** Spec governance (sdd naming convention)

## Context

Per the Filename Conventions defined in `sdd/README.md` (promoted after `stats-dlq`), a Spec
that is reviewed, validated and `done` is promoted to `sdd/<feature>.spec.md` to become the
canonical, referenceable contract. `sdd/stats-tests.md` is `done` (reviewed; wording
discrepancies already fixed in `documents/legacy/plans/stats-tests-spec-fixes/plan.md`) and is
now promoted.

## Tasks

- [ ] Rename `sdd/stats-tests.md` → `sdd/stats-tests.spec.md` (`git mv`).
- [ ] Update the Backlog row in `sdd/README.md` to `stats-tests.spec.md`.
- [ ] Update navigation/file-path references in `sdd/docs-migration.md` (FR-005, Architecture tree, Files) to `sdd/stats-tests.spec.md`.
- [ ] Update `documents/modules/stats.md` §Status/Roadmap reference to `sdd/stats-tests.spec.md`.
- [ ] Leave historical references in `documents/error/error.md` and `documents/legacy/plans/*` unchanged (records, not navigation).

## Validation

- `rg -n "stats-tests"` finds no remaining *navigation* reference to `sdd/stats-tests.md` in stable docs or current Specs.
- No code, tests or application behavior change.

## Notes

Archived to `documents/legacy/plans/stats-tests-spec-promotion/plan.md` and marked
`Status: Historical / Non-Authoritative` after execution.