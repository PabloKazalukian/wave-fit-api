# Plan — Documentation Migration to Spec-Anchored Development

> **Status:** Historical / Non-Authoritative
> **Executed on branch:** `feat/sdd`
> **Spec:** `sdd/docs-migration.md`
> **Closed:** 2026-09-12 — final validation TEST-001..TEST-008 passed in this Plan (see the Migration Report below).
> **Note:** Once completed, the status of THIS file changes to `Status: Historical / Non-Authoritative`.

## 1. Implementation Strategy

Migrate the documentation incrementally, phase by phase, creating the canonical documents before deleting their old sources. Each phase is validated (structure + links + English scan + no code change) before moving to the next. No application behavior is modified.

## 2. Sequence of Work (Tasks)

### Phase 1 — Foundation (Charter + Git workflow)
- Create `documents/engineering/charter.md` (Spec-Anchored methodology, source of truth, lifecycle, test-first, language, branches).
- Create `documents/engineering/git-workflow.md` (`feat/<name>` / `fix/<name>`).
- Validate: files exist, English.

### Phase 2 — Migration contract
- Write `sdd/docs-migration.md` (this migration's Spec).
- Write this Plan (`documents/plans/docs-migration/plan.md`).

### Phase 3 — Engineering documentation
- Create `documents/engineering/{architecture,testing,coding-standards,ci-cd,seed}.md` from: AGENTS.md structural/architecture sections, `documents/config/testing.md` (correcting the stale dual-Jest warning), `documents/config/seed.md`, `documents/config/ai.md` (transversal parts), `documents/fix.md` (Mongoose lesson → coding-standards), `documents/reports/criterios-cobertura-tests.md` (→ testing.md), and the repo's real conventions.
- `ci-cd.md` must state honestly that no CI pipeline exists today and document the manual quality gates.

### Phase 4 — Domain documentation
- Create `documents/domain/{overview,glossary,business-rules}.md`. Business rules are cross-feature only (e.g. empty-day → rest); feature-specific rules stay in Specs.

### Phase 5 — ADRs
- Create `documents/decisions/README.md` + ADR-0001..0007 (cookie auth, GraphQL, MongoDB/Mongoose + ObjectId lesson, hexagonal tracking, Google OAuth PKCE, AI provider strategy, stats SQS worker + pending DLQ).

### Phase 6 — Specs
- Rewrite `sdd/README.md` with new spec governance + template (Context/Requirements/Constraints/Architecture/Files/Tests/Acceptance Criteria; identifiers FR/BR/NFR/TEST/AC).
- Create `sdd/day-log.spec.md` (completed contract, from `sdd/day-log.md`) and `sdd/training-plan.spec.md` (completed, from `src/modules/training-plan/README.md` + plans).
- Add backlog specs: `sdd/stats-dlq.md`, `sdd/levenshtein-routine.md`, `sdd/stats-tests.md` (draft status).

### Phase 7 — Plans
- Create `documents/plans/README.md` + plan template.
- Migrate to per-feature folders and mark Historical / Non-Authoritative:
  - `documents/plans/day-log/plan.md` ← `documents/plans/plan-implementar-day-log.md`
  - `documents/plans/training-plan-update/plan.md` ← `documents/plans/plan-actualizacion-modulo-ia-trainingplan.md`
  - `documents/plans/ai-idempotency-retry/plan.md` ← `documents/plans/plan-idempotencia-ratelimit-logging-retry.md`
  - `documents/plans/graphql-collisions/plan.md` ← `documents/plans/plan-corregir-colisiones-nombres-graphql.md`
  - `documents/plans/modify-plan/plan.md` ← `plans/ai/modifate/` (README + FASE-1..6)
- Keep `documents/plans/stats-dlq/plan.md` active (pending feature) alongside its Spec.

### Phase 8 — Entry points
- Rewrite `AGENTS.md` (English, navigation + rules, references canonical docs).
- Rewrite `README.md` (English, purpose/setup/usage + links).

### Phase 9 — Module documentation
- Create `documents/modules/{ai,training-plan,stats,user-profile,auth}.md` from the module READMEs and `documents/config/*`.
- Remove module READMEs from `src/modules/` (ai, training-plan, stats README+CONTRACT+LAMBDA, auth, user-profile).

### Phase 10 — Cleanup and hygiene
- Delete `documents/config/` (content consolidated), `documents/reports/`, `documents/analysis/`, `documents/fix.md`, `documents/interfaces/`, `documents/prompt.md` (methodology absorbed by Charter), root `plans/`, and the old `documents/plans/*.md` files.
- Update `.gitignore`; ensure no compiled artifacts are tracked.

### Phase 11 — Final validation + report
- Run Spec tests `TEST-001`..`TEST-008`.
- Deliver the canonical Migration Report (Created / Moved / Merged / Rewritten / Archived / Deleted / Important Decisions / Remaining Ambiguities / Source-of-Truth Model).
- Mark `docs-migration` Spec as completed and this Plan as Historical / Non-Authoritative.

## 3. Dependencies

- Phases are sequential; content consolidation (3,4,5,9) must precede deletions (10).
- The `AGENTS.md` rewrite (8) depends on the final document paths (3-7).

## 4. Validation Strategy

- Per phase: structure check + old-path grep + English scan + `git status` review.
- Final: `TEST-001`..`TEST-008` from the Spec.

## 5. Expected Files

See the `Files` section of `sdd/docs-migration.md`.

## 6. Migration Steps

Already described under *Sequence of Work*.

## 7. Testing Strategy

Consists of the Spec's `Tests` section (`TEST-001`..`TEST-008`); no application tests change.

## 8. Completion

On completion: `git diff` over `src/` and `test/` is empty except for removed module READMEs; the repo layout matches `sdd/docs-migration.md` Architecture; the Migration Report is delivered.

## 9. Migration Report

**Status:** Done — executed 2026-09-12 on `feat/sdd`; validation `TEST-001`..`TEST-008` passed.

### Created

- `documents/engineering/{charter,architecture,testing,coding-standards,git-workflow,ci-cd,seed}.md`
- `documents/domain/{overview,glossary,business-rules}.md`
- `documents/decisions/README.md` + `ADR-0001`..`ADR-0007`
- `documents/modules/{ai,training-plan,stats,user-profile,auth}.md`
- `sdd/{day-log.spec.md, training-plan.spec.md, stats-dlq.md, levenshtein-routine.md, stats-tests.md, docs-migration.md}`
- `documents/plans/README.md` + `documents/plans/{day-log,training-plan-update,ai-idempotency-retry,graphql-collisions,modify-plan,stats-dlq,docs-migration}/plan.md`

### Moved

- Root `plans/ai/modifate/` (`README.md` + `FASE-1..6`, 7 files) → `documents/plans/modify-plan/plan.md`
- Old `documents/plans/*.md` (5 files) → per-feature folders (`day-log`, `training-plan-update`, `ai-idempotency-retry`, `graphql-collisions`, `stats-dlq`)
- `sdd/day-log.md` → `sdd/day-log.spec.md` (content reworked into the canonical spec structure)

### Merged (absorbed content)

- `documents/config/testing.md` → `documents/engineering/testing.md` (corrected the stale dual-Jest-config warning; `jest.config.js` is the single source of truth)
- `documents/reports/criterios-cobertura-tests.md` + coverage reports → `documents/engineering/testing.md` (coverage criteria and measured numbers preserved)
- `documents/fix.md` (Mongoose `ObjectId` lesson) → `ADR-0003` + `documents/engineering/coding-standards.md`
- `documents/analysis/review-ai-plan-generation.md` → findings folded into `documents/modules/training-plan.md` and the historical `training-plan-update` plan
- `documents/config/seed.md` + seed facts → `documents/engineering/seed.md` (catalog corrected from 28 to 30 exercises)
- `documents/config/ai.md` → `documents/modules/ai.md` + `documents/modules/training-plan.md` (+ `sdd/training-plan.spec.md`)
- `documents/config/{auth_module,authentication,cookie_configuration,login_flows}.md` → `documents/modules/auth.md` + `ADR-0001`/`ADR-0005`
- `documents/prompt.md` (SDD methodology) → `documents/engineering/charter.md`
- `src/modules/{ai,training-plan,stats,auth,user/user-profile}/*` README/CONTRACT/LAMBDA → `documents/modules/*.md` (auth corrected to the HttpOnly-cookie flow)

### Rewritten

- `AGENTS.md` — navigation + rules entry point (English)
- `README.md` — project overview (English)
- `sdd/README.md` — spec governance + canonical template (replaces the RFC 2119 `_TEMPLATE.md`)

### Archived

- Decision rationale → `documents/decisions/ADR-0001..0007`
- Executed implementation plans → `documents/plans/<feature>/plan.md`, each marked `Status: Historical / Non-Authoritative` (except `stats-dlq`, which stays `Active / Pending`)

### Deleted

- `documents/config/` (7 files), `documents/reports/` (4 files), `documents/analysis/` (1 file)
- `documents/fix.md`, `documents/interfaces/` (incl. 3 committed compiled artifacts), `documents/prompt.md`
- Root `plans/` tree (modifate files), old `documents/plans/*.md` (5 files)
- `sdd/_TEMPLATE.md` (RFC 2119), `sdd/day-log.md` (superseded by `day-log.spec.md`)
- Module READMEs under `src/modules/` (7 files), `documents/as.md` (secret-bearing, never committed)

### Important Decisions

- **Spec + Code are authoritative**; Plans are historical/non-authoritative records; ADRs preserve rationale.
- Keep the existing folder names `sdd/` + `documents/` (project decision); the migration blueprint is adapted inside them.
- All engineering/documentation artifacts are in **English**; agent↔developer communication stays in the developer's requested language.
- Only `day-log` and `training-plan` get `Done` Specs; `stats` remains experimental (0% coverage) with Draft specs.
- Auth is documented as JWT in an HttpOnly `token` cookie; the contradictory Bearer-header README was deleted.
- No CI pipeline exists today; `ci-cd.md` documents the manual quality gates (build → lint → unit → e2e).

### Remaining Ambiguities

- The `stats` SQS/Lambda stack is described conceptually (ADR-0007 + `documents/modules/stats.md`); the AWS topology and credentials were never verifiable in this repo.
- Historical Spanish coverage reports were deleted; their numbers survive in `documents/engineering/testing.md` (historical evolution table).
- Any tracked coverage artifacts outside `documents/` (e.g. `test/coverage/lcov-report`) are outside this migration's scope.
- `stats-dlq` remains a Draft spec + Active plan (backlog), intentionally.

### Source-of-Truth Model

Spec + Code are authoritative for feature behavior; `sdd/` holds feature contracts; `documents/engineering/domain/modules` are stable reference; `documents/decisions/` is decision rationale; `documents/plans/` is historical/non-authoritative; `AGENTS.md` is the navigation entry point.