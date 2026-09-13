# AGENTS.md

## Purpose

This file is the entry point for AI agents and engineers.

It defines navigation rules and mandatory development behavior.
It does not contain detailed architectural, domain, feature, or
implementation documentation.

## Mandatory Read Order

1. `documents/engineering/charter.md`
2. Relevant engineering documentation
3. Relevant domain documentation
4. Relevant ADRs
5. Relevant Spec
6. Relevant existing code and tests
7. Create or review the Plan

## Development Workflow

Engineering Charter
→ Spec
→ Clarification
→ Plan
→ Tasks
→ Tests
→ Implementation
→ Validation
→ Documentation Update

## Source of Truth

For implemented behavior:

- Spec + Code are authoritative.
- Stable documentation describes the validated current system.
- ADRs preserve decision rationale.
- Plans are historical and non-authoritative.

A contradiction between Spec and Code must be explicitly resolved.
Do not silently choose one.

## Planning

A Plan is mandatory before implementation, regardless of whether
the developer explicitly requests planning.

Plans live in:

`documents/plans/<feature>/plan.md`

Plans are implementation artifacts and never define current behavior.

## Implementation

- One task at a time.
- Tests first.
- Validate each task.
- Do not implement unspecified behavior.
- Do not silently change contracts.

## Changes

If implementation reveals that the Spec is incomplete or incorrect:

Spec
→ Clarification
→ Plan
→ Tasks
→ Tests
→ Code
→ Validation
→ Documentation

## Documentation

Stable documentation is updated only after validation.

Do not duplicate feature behavior in engineering documentation.

Do not use Plans as current documentation.

## Language

- Code: English.
- Technical documentation: English.
- Specs: English.
- Developer-facing responses: developer's requested language.
- User-facing application content: product language.

## Repository Map

- `src/` — application code
- `documents/engineering/` — stable engineering knowledge
- `documents/domain/` — stable domain knowledge
- `documents/decisions/` — ADRs
- `sdd/` — feature Specs
- `documents/plans/` — implementation plans/history