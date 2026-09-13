# Documentation Migration to Spec-Anchored Development

> **Status:** Done (executed and validated 2026-09-12 on `feat/sdd`; Migration Report in `documents/plans/docs-migration/plan.md` §9)

## Context

The repository accumulated documentation in multiple homes with duplication and contradictions:

- Docs lived in `documents/config/`, `documents/plans/`, `documents/reports/`, `documents/analysis/`, loose files (`documents/fix.md`), the `sdd/` spec backlog, a root `plans/` tree, and README files inside `src/modules/` (ai, training-plan, stats, auth, user-profile).
- The same knowledge was duplicated in up to three places (e.g. AI in `documents/config/ai.md`, `src/modules/ai/README.md`, `src/modules/training-plan/README.md`).
- `src/modules/auth/Readme.md` described a Bearer-header token flow that contradicts the implemented HttpOnly-cookie flow.
- `documents/config/testing.md` still warned about a dual Jest configuration that no longer exists (the `jest` block was removed from `package.json`; `jest.config.js` is the only config).
- Compiled artifacts were committed under `documents/interfaces/` (`extra-session.types.js`, `.js.map`).

The goal is a Spec-Anchored documentation architecture: Spec + Code authoritative, stable documentation reflecting the current validated state, Plans historical/non-authoritative, ADRs preserving decision rationale, all engineering artifacts in English.

## Requirements

### Functional Requirements

- `FR-001` — Create the canonical engineering documents under `documents/engineering/`: `charter.md`, `architecture.md`, `testing.md`, `coding-standards.md`, `git-workflow.md`, `ci-cd.md`, `seed.md`. All must be written in English and describe only behavior/rules that actually exist.
- `FR-002` — Create the domain documents under `documents/domain/`: `overview.md`, `glossary.md`, `business-rules.md`, in English, without duplicating feature requirements that belong in Specs.
- `FR-003` — Create `documents/decisions/README.md` and ADR documents (`ADR-0001` .. `ADR-0007`) capturing engineering decision rationale (cookie auth strategy, GraphQL, MongoDB/Mongoose incl. the ObjectId lesson, hexagonal tracking, Google OAuth PKCE, AI provider strategy, stats SQS worker). Do not lose valuable historical reasoning.
- `FR-004` — Create module state documents under `documents/modules/` (`ai.md`, `training-plan.md`, `stats.md`, `user-profile.md`, `auth.md`) describing the implemented, validated state of each module, and remove the module README files from `src/modules/` (including `auth/Readme.md`, which contradicts the code).
- `FR-005` — Reorganize `sdd/` as the Spec home using the canonical spec structure (`Context`, `Requirements`, `Constraints`, `Architecture`, `Files`, `Tests`, `Acceptance Criteria`), with a spec README that embeds the template and identifier conventions (`FR-*`, `BR-*`, `NFR-*`, `TEST-*`, `AC-*`). Migrate `sdd/day-log.md` to `sdd/day-log.spec.md` reflecting implemented behavior, and add `sdd/training-plan.spec.md` plus the backlog specs `stats-dlq.md`, `levenshtein-routine.md`, `stats-tests.md`, and `docs-migration.md` (this spec).
- `FR-006` — Reorganize plans under `documents/plans/<feature>/plan.md`. Migrate the five existing plans in `documents/plans/*.md` and the `plans/ai/modifate/` tree into per-feature folders. Completed plans must be marked `Status: Historical / Non-Authoritative`. The executed plan for this migration lives at `documents/plans/docs-migration/plan.md`.
- `FR-007` — Rewrite the root `AGENTS.md` in English as the AI entry point: navigation and rules, referencing canonical documents instead of duplicating them. It must instruct: read the Charter, read relevant engineering/domain docs and ADRs, identify the relevant Spec, plan before implementing, execute one task at a time, tests first, validate after each task, update stable documentation only after validation, never treat Plans as authoritative, treat Spec + Code as the authoritative implementation state, update the Spec before changing behavior, follow English language rules for code and technical docs, and keep developer-facing communication in the developer's requested language.
- `FR-008` — Rewrite the root `README.md` in English, focused on purpose, setup, development, basic usage, and links to the canonical documentation.
- `FR-009` — Remove obsolete/duplicated content: `documents/config/` (after its content is consolidated), `documents/reports/`, `documents/analysis/`, `documents/fix.md`, `documents/interfaces/`, `documents/prompt.md` (after its methodology is absorbed by the Charter), and the root `plans/` tree.
- `FR-010` — Update `.gitignore` so the path rules match the new layout and no compiled artifacts are tracked.

### Business Rules

- `BR-001` — Documentation must describe the current validated system state. No document may invent behavior not supported by Spec and Code.
- `BR-002` — Contradictions between documents are resolved against the current Code and the relevant Spec; do not blindly choose the newest filename or date.

### Non-Functional Requirements

- `NFR-001` — All new and rewritten engineering documents must be written in English.
- `NFR-002` — No application behavior may change: no business logic, API, schema, identifier, test, dependency, or deployment-configuration changes.
- `NFR-003` — After migration there must be no broken internal documentation links (paths to the old `documents/config/...`, `sdd/...`, `plans/ai/...` layouts).
- `NFR-004` — No document may be reported as deleted/moved/validated unless the operation was actually performed and verified.

## Constraints

- Do not implement application features or refactor source code.
- Keep the existing `sdd/` and `documents/` directory names (project decision); the blueprint structure of the migration prompt is adapted inside these two homes.
- Preserve meaningful historical information; use ADRs and historical Plans for that purpose.
- Do not create empty placeholder documents or artificial duplicates to preserve old filenames.
- Do not claim CI/CD capability exists unless it does.

## Architecture

- Repository documentation layout after migration (see the migration Plan in `documents/plans/docs-migration/plan.md`):

```text
/
├── AGENTS.md
├── README.md
├── sdd/                          # Specs (feature contracts)
│   ├── README.md                 # Spec governance + template
│   ├── docs-migration.md         # this spec
│   ├── day-log.spec.md
│   ├── training-plan.spec.md
│   ├── stats-dlq.md
│   ├── levenshtein-routine.md
│   └── stats-tests.md
├── documents/
│   ├── engineering/              # charter, architecture, testing, coding-standards, git-workflow, ci-cd, seed
│   ├── domain/                   # overview, glossary, business-rules
│   ├── modules/                  # ai, training-plan, stats, user-profile, auth
│   ├── decisions/                # README + ADR-0001..0007
│   └── plans/                    # README + <feature>/plan.md
└── src/                          # unchanged, module READMEs removed
```

- Authority levels: Spec + Code = authoritative current state; `documents/engineering`, `documents/domain`, `documents/modules` = stable reference; `documents/decisions` = decision rationale; `sdd/` = feature contracts; `documents/plans/` = historical/non-authoritative execution artifacts (except active/backlog plans).

## Files

- `documents/engineering/charter.md` (created)
- `documents/engineering/architecture.md` (created)
- `documents/engineering/testing.md` (created)
- `documents/engineering/coding-standards.md` (created)
- `documents/engineering/git-workflow.md` (created)
- `documents/engineering/ci-cd.md` (created)
- `documents/engineering/seed.md` (created)
- `documents/domain/overview.md` (created)
- `documents/domain/glossary.md` (created)
- `documents/domain/business-rules.md` (created)
- `documents/decisions/README.md` + `ADR-0001.md` .. `ADR-0007.md` (created)
- `documents/modules/ai.md`, `training-plan.md`, `stats.md`, `user-profile.md`, `auth.md` (created)
- `sdd/README.md` (rewritten), `sdd/day-log.spec.md`, `sdd/training-plan.spec.md`, `sdd/stats-dlq.md`, `sdd/levenshtein-routine.md`, `sdd/stats-tests.md`, `sdd/docs-migration.md` (created/updated)
- `documents/plans/README.md` + per-feature plan folders (created/moved)
- `AGENTS.md`, `README.md` (rewritten)
- Deleted: module READMEs under `src/modules/`, `documents/config/`, `documents/reports/`, `documents/analysis/`, `documents/fix.md`, `documents/interfaces/`, `documents/prompt.md`, root `plans/`, and the old `documents/plans/*.md` files after migration.

## Tests

- `TEST-001` — Repository layout: verify the target directories exist and no empty placeholders remain.
- `TEST-002` — Link integrity: no *navigation* reference to the retired layouts (`documents/config/`, `sdd/day-log.md`, `plans/ai/`, module READMEs in `src/modules/`) remains in the stable docs (`documents/engineering|domain|modules|decisions`), in Specs, or in `AGENTS.md`/`README.md`. Historical Plans may document paths as they existed at plan time; these are records, not navigation.
- `TEST-003` — English scan: engineering documents under `documents/` and `sdd/` contain no Spanish prose (technical terms and code remain untouched).
- `TEST-004` — No code behavior change: `git diff` of `src/` and test files must be empty except for the removed module READMEs.
- `TEST-005` — `AGENTS.md` and `README.md` contain navigation links that resolve to existing files.
- `TEST-006` — Every completed Plan carries `Status: Historical / Non-Authoritative`.
- `TEST-007` — `git status` shows only intended documentation moves/removals; no node_modules, coverage, or build artifacts are staged.
- `TEST-008` — Full validation suite still green: `npm run build`, `npm run lint`, `npm test`, `npm run test:e2e` (read-only safety run; results must not change from baseline).

## Acceptance Criteria

- `AC-001` — An engineer or a fresh AI session can answer *governance, architecture, domain vocabulary, decision rationale, feature requirements, implementation approach, implemented state, historical reason* questions by navigating `AGENTS.md` → `documents/` + `sdd/`, without reading module-internal READMEs.
- `AC-002` — The ambiguity metrics improved: for each knowledge category there is exactly one canonical location; the AI module has exactly one home (`documents/modules/ai.md` + specs), auth has consistent documentation consistent with the HttpOnly-cookie code.
- `AC-003` — A migration report following the canonical `Created / Moved / Merged / Rewritten / Archived / Deleted / Important Decisions / Remaining Ambiguities / Source-of-Truth Model` structure is delivered and truthful.
- `AC-004` — The migration is reproducible from the Plan; the Plan is marked Historical / Non-Authoritative on completion.