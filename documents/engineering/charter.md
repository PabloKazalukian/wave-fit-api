# Engineering Charter — WaveFit API

> **Status:** Current
> **Last updated:** 2026-09-12
> **Authority level:** Stable engineering rule. This document defines how the project is engineered, not what the product does. Product/feature behavior lives in Specs.

## 1. Purpose

This Charter defines the stable engineering principles and development methodology of the WaveFit API project. It is the entry point for any engineer or AI agent that must understand **how** the project is developed, changed, documented, and validated.

The Charter must never contain feature-specific implementation details. Those belong in Specs and Plans.

## 2. Core Development Model: Spec-Anchored Development

This project follows a **Spec-Anchored Development** model.

The fundamental principle:

> **The current Spec and the current Code are the authoritative sources for implemented behavior.**

- Documentation explains the architecture, domain, engineering rules, decisions, and completed system state.
- Plans are temporary execution artifacts. They are **never authoritative**.
- Specs are feature-level contracts. The Spec + the implemented Code define what the system actually does today.

### Development lifecycle

```text
Engineering Charter
        ↓
      Spec
        ↓
 Clarification
        ↓
      Plan
        ↓
     Tasks
        ↓
Implementation
        ↓
   Validation
        ↓
Documentation Update
        ↓
     Completed
```

### Lifecycle for changes to existing functionality

```text
Requested Change
       ↓
Update Spec
       ↓
Clarification
       ↓
Plan
       ↓
Tasks
       ↓
Tests
       ↓
Implementation
       ↓
Validation
       ↓
Documentation Update
```

**Never make a behavioral change directly in code while leaving the Spec unchanged.**

## 3. Source-of-Truth Rules

Within the repository, the following hierarchy applies (highest authority first):

```text
1. Code + current Spec
2. Stable engineering/domain documentation
3. ADRs
4. Plans
5. Historical artifacts
```

This hierarchy must be interpreted carefully:

- **During implementation**, `Spec + Code` are authoritative.
- **Plans** describe *how a change was intended to be implemented*. They are not specifications, not architectural documentation, not sources of truth. They exist for implementation guidance, task organization, traceability, and historical review. A completed plan must be marked `Status: Historical / Non-Authoritative`. **Never use an old plan to determine the current behavior of the system.**
- **Stable documentation** must describe the **current validated state** of the project. When a feature is completed and validated, update the relevant stable documentation as the final step. Do not use documentation to invent behavior not supported by the Spec and Code.
- **ADRs** preserve the *rationale* behind important technical decisions. They answer *"Why did we choose this?"*, not *"What does the system do today?"*.

## 4. Test-First Policy

- Tests are written **before** the implementation of each layer or task.
- A feature is considered complete only when its tests are green and the full validation suite passes.
- Every hard requirement (`MUST`, `FR-*`, `BR-*`, `NFR-*`) must have at least one test that covers it.
- Test scenarios are validated with stable commands; see `documents/engineering/testing.md` for the canonical testing strategy and command list.
- Failing test = spec bug or spec gap: fix against the Spec, never improvise.

## 5. Task Execution Rules

- Implementation happens **one task at a time**. Do not implement an entire plan in one uncontrolled operation.
- For each task:

```text
Task
 ↓
Write/update tests
 ↓
Implement
 ↓
Run relevant validation
 ↓
Confirm task completion
```

- Do not move to the next task until the current one passes its validation.

## 6. Documentation Rules

- Documentation updates happen **after implementation and validation** for completed features:

```text
Spec
 ↓
Plan
 ↓
Tasks
 ↓
Tests
 ↓
Code
 ↓
Validation
 ↓
Stable Documentation Update
```

- The final documentation update must describe the **validated current state**.
- Do not update stable architecture/domain/testing documentation prematurely based only on an unfinished plan.
- Every important piece of project knowledge must have: **one clear purpose, one canonical location, one defined authority level, and a predictable relationship with Specs and Code**.

## 7. Change Management Rules

If implementation reveals that the current Spec is wrong or incomplete:

- **Do not** silently modify the code to accommodate an undocumented requirement.
- Instead:

```text
Identify discrepancy
        ↓
Update Spec
        ↓
Clarify if necessary
        ↓
Update Plan
        ↓
Update Tasks
        ↓
Update Tests
        ↓
Update Code
        ↓
Validate
        ↓
Update stable documentation
```

- The Spec must remain aligned with the intended behavior.

## 8. Language Conventions

- All project **engineering artifacts** must use **English**: specs, plans, architecture/testing/engineering documentation, ADRs, domain documentation, coding standards, CI/CD and Git documentation, technical terminology, source code identifiers (classes, interfaces, functions, variables, types), database structural identifiers, API contracts, and configuration identifiers.
- **Developer-facing AI responses** may remain in the language requested by the developer (e.g. Spanish).
- **User-facing application content** may use the language required by the product. Existing user-facing product data (e.g. a Spanish exercise catalog) must **not** be translated merely to satisfy this rule.

## 9. Branch Conventions

- Feature work: `feat/<feature-name>`.
- Bug fixes: `fix/<bug-name>`.
- `main` is the integration branch; it is **never** worked on directly for feature changes.
- Detail: `documents/engineering/git-workflow.md`.

## 10. Planning Is Always Required

Planning is mandatory regardless of how a change is requested. If the developer asks "implement X", the workflow must still be:

```text
Read AGENTS.md
      ↓
Read relevant engineering/domain documentation
      ↓
Read relevant Spec
      ↓
Clarify if necessary
      ↓
Create/revise Plan
      ↓
Create Tasks
      ↓
Implement one task
      ↓
Tests first
      ↓
Validate
      ↓
Next task
```

The AI must not skip planning merely because the developer did not explicitly request "plan mode".

## 11. General Engineering Principles

- **Stable over expedient:** refactor and evolve documentation as a first-class activity, not a cleanup afterthought.
- **Low duplication:** there must be one canonical location for each category of knowledge. Do not preserve duplication merely because the information already exists in multiple files.
- **Honesty of claims:** never document the existence of a capability (CI pipeline, endpoint, feature) that the code does not actually implement.
- **Traceability:** every requirement, test, and behavior should be traceable to a Spec line, a Plan task, or an ADR decision.
- **Preserving history:** consolidation may not destroy meaningful historical decisions. Use ADRs for decision rationale, Plans for implementation history, Specs for feature contracts, and engineering documentation for stable rules.
- **Quality gates:** `npm run build`, `npm run lint`, `npm test`, and `npm run test:e2e` are the canonical verification commands. See `documents/engineering/testing.md`.