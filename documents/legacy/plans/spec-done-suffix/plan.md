# Plan — Spec `.spec` suffix convention and promotion of `stats-dlq`

> **Status:** Historical / Non-Authoritative
> **Feature:** Spec governance (sdd naming convention)

## Context

The `sdd/` folder mixes `*.spec.md` and `*.md` files with no documented criterion. Review
of `stats-dlq` confirmed it is fully implemented, reviewed and `done`. This change:

1. Establishes a governance rule in `sdd/README.md`: a Spec is promoted to `sdd/<feature>.spec.md`
   when it is reviewed, validated and marked `done`, becoming the canonical contract for
   subsequent work on the feature.
2. Promotes `sdd/stats-dlq.md` to `sdd/stats-dlq.spec.md` (the only spec promoted in this change).

## Tasks

- [ ] Do not touch other specs; only `stats-dlq` is renamed in this change.
- [ ] Rename `sdd/stats-dlq.md` → `sdd/stats-dlq.spec.md` (`git mv`).
- [ ] Add a "Filename Conventions" section to `sdd/README.md` (after "Identifier Conventions").
- [ ] Update the Backlog row in `sdd/README.md` to `stats-dlq.spec.md`.
- [ ] Update navigation/file-path references in `sdd/docs-migration.md` to `sdd/stats-dlq.spec.md`.
- [ ] Leave historical references in `documents/legacy/plans/*` unchanged (records, not navigation).

## Validation

- `rg -n "stats-dlq"` finds no remaining *navigation* reference to `sdd/stats-dlq.md` in stable
  docs or current Specs.
- No code, tests or application behavior change.

## Notes

After execution the plan is archived to `documents/legacy/plans/spec-done-suffix/plan.md`
and marked `Status: Historical / Non-Authoritative`.