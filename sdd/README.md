# Spec Governance

`sdd/` is the Spec home of the project. A **Spec** is a **feature contract**: a self-contained document that an engineer or an AI agent can implement without external conversation context. It states the requirements, the constraints, the architecture, the files involved, the tests that prove it, and the acceptance criteria that decide when it is done.

This README is the governance document: what a Spec is, the mandatory structure, the identifier conventions, the lifecycle, and the authority rules that bind Specs to the rest of the repository.

## What a Spec is

- A Spec describes **one feature** (or one coherent unit of work) as a contract between intent and implementation.
- A Spec is **self-contained**: anyone reading it can implement and verify the feature without additional context.
- A Spec is **authoritative for the behavior it covers**: while a feature is changing, the Spec is the source of truth; once implemented and validated, Spec + Code together describe the current state.
- A Spec is **living**: it is updated when the behavior changes. Modifying the Spec before changing behavior is part of the workflow, not an afterthought.

## Mandatory Section Structure

Every Spec file in `sdd/` MUST follow this exact section structure:

```markdown
# [Feature Name]

## Context

## Requirements

## Constraints

## Architecture

## Files

## Tests

## Acceptance Criteria
```

The full template with guidance is embedded at the bottom of this README.

## Identifier Conventions

Requirements, tests and acceptance criteria carry explicit identifiers that link the Spec to code review and validation:

| Prefix | Meaning |
|--------|---------|
| `FR-001` | Functional requirement |
| `BR-001` | Business rule |
| `NFR-001` | Non-functional requirement |
| `TEST-001` | Test that must exist and pass |
| `AC-001` | Acceptance criterion |

- Identifiers are unique within a Spec file and are never reused after a requirement is removed.
- Code identifiers, file paths, enum values, module/command names inside a Spec are written exactly as they appear in the sources.

## Lifecycle

```
draft → in_progress → done
```

1. **`draft`** — the feature is specified but not being implemented yet. Requirements, constraints and tests may still be refined.
2. **`in_progress`** — an engineer or agent started implementing the Spec. Tests are written first, layer by layer (test-first).
3. **`done`** — every requirement and test in the Spec passes the canonical verification workflow (see below), and the behavior it covers is validated.

Status is declared in a front-matter-like header at the top of the file using a Markdown blockquote, for example:

```
> **Status:** done
> **Priority:** high
```

A Spec that was archived keeps `> **Status:** done` only if it reflects implemented behavior; a Spec that is superseded is retired (removed or archived) explicitly, never silently.

## Authority Rules

- **Spec + Code are the authoritative sources for implemented behavior.** Stable documentation (`documents/engineering/`, `documents/domain/`, `documents/modules/`) describes current validated state; the Spec describes the contract the code implements. Contradictions are resolved against Code and the relevant Spec.
- **Plans are never authoritative.** Plans are execution artifacts: they record the path that was taken (or proposed), phases and user decisions. They describe history or intent, not the current state. When a Plan is prioritized it is **distilled into a Spec**, and the Plan then serves as reference/context only.
- A requirement or failing test is never "fixed around" the Spec by improvising: the fix is made against the Spec, and any Spec refinement is a deliberate, documented change.

## Relationship to Other Homes

| Home | Role | Authority |
|------|------|-----------|
| `sdd/` | Feature contracts (this folder) | Authoritative for feature behavior |
| `src/` | Implementation | Authoritative for current state |
| `documents/engineering/` | Stable rules: testing, coding standards, architecture, CI/CD, workflow | Stable reference (must not contradict Spec + Code) |
| `documents/domain/` | Domain vocabulary, shared business rules | Stable reference |
| `documents/modules/` | Implemented, validated module state | Stable reference |
| `documents/decisions/` | ADRs — decision rationale | Historical reference |
| `documents/plans/` | Execution artifacts (per-feature `plan.md` folders) | Active / pending plans only |
| `documents/legacy/plans/` | Implemented (historic) plans, archived | Historical / non-authoritative |
| The template below | Canonical spec structure | Replaces the legacy RFC 2119 `_TEMPLATE.md` (removed) |

## Demand Tests for Every Requirement

- Each `FR-*`, `BR-*` and `NFR-*` requirement MUST be covered by at least one test in the `Tests` section of the Spec, identified as `TEST-*`.
- Tests are written **before** the implementation of the layer they protect (test-first by layer: domain → infrastructure → application → presentation).
- A Spec is not `done` if any listed `TEST-*` is missing, skipped, or red.
- Tests reflect the **current** behavior of the code (see `documents/engineering/testing.md` section 6 for evolved-contract lessons), not historical expectations.

## Canonical Verification Workflow

The final gate of a `done` Spec is the same automated CI gate that runs on every pull request and push to `main` (see `documents/engineering/ci-cd.md`); run it locally with:

```bash
npm run build
npm run lint:ci
npm test
npm run test:e2e
```

- Runs must pass in the whole repository, not only the changed module (existing suites for related modules must stay green).
- Targeted run during development (faster loop):

```bash
npx jest --config jest.config.js <module-or-file-path>
npx jest --config ./test/jest-e2e.json <e2e-file-path>
```

- Canonical operational test details: `documents/engineering/testing.md`.

## Template

This is the template a new Spec must follow (it replaces the legacy `_TEMPLATE.md`, which was removed):

```markdown
# [Feature Name]

> **Status:** draft | in_progress | done
> **Priority:** high | medium | low

## Context

Why this Spec exists. What exists today and what is missing.
Link the originating Plan/ADR when relevant (as reference, never as authority).

## Requirements

### Functional Requirements

- `FR-001` — <one verifiable behavior, referencing real files/enum values where relevant.>

### Business Rules

- `BR-001` — <a business rule the feature must enforce.>

### Non-Functional Requirements

- `NFR-001` — <a quality constraint: performance, security, testability, internal consistency, naming, language conventions.>

## Constraints

- Things that must NOT be done or changed (e.g. do not touch files outside the checklist, do not change application behavior, do not invent a new architecture when a reference pattern exists).

## Architecture

- Design, layers, flow, or pattern the feature follows. Reference the canonical module to imitate when applicable.

## Files

- Real file paths to create/rewrite/modify, one per bullet. Mark intent when useful: `(new)` / `(modify)` / `(reference)`.

## Tests

- `TEST-001` — <test or suite that proves `FR-001`...>
- ... (one per requirement at least; each referencing the real spec file path.)

## Acceptance Criteria

- `AC-001` — <objective, verifiable condition that marks the feature done.>
- The canonical verification workflow passes: `npm run build`, `npm run lint`, `npm test`, `npm run test:e2e`.
```

## Backlog

| Spec | Status | Notes |
|------|--------|-------|
| `day-log.spec.md` | done | Standalone training day, fully implemented hexagonal module (Fase A–D) |
| `training-plan.spec.md` | done | AI plan generation + confirmation pipeline, implemented and validated |
| `stats-dlq.md` | done | DLQ for stats SQS events via audit-logs + SQS publisher error handling |
| `levenshtein-routine.md` | draft | Extend name-similarity control to RoutineDay/RoutinePlan |
| `stats-tests.spec.md` | done | Unit tests for the pure stats use cases (currently 0% coverage → pure use cases + publisher covered; promoted `.spec` 2026-09-21) |
| `docs-migration.md` | done | This doc-migration effort (Spec-Anchored Development) |