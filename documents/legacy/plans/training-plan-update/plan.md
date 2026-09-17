# Plan: Update IA-TrainingPlan Module — canonical documentation + cleanup of inherited mutations

> **Status:** Historical / Non-Authoritative
> **Spec:** `sdd/training-plan.spec.md`

## Status

Approved as an implementation plan (dated 2026-08-29, "approved, pending implementation") and executed as part of the AI/TrainingPlan feature. The authoritative contract for this feature is now consolidated in the Spec `sdd/training-plan.spec.md`. This plan is kept for traceability and historical review only.

---

## Context

`src/modules/ai` and `src/modules/training-plan` are **fully functional** (AI generation, rate limit, retry/backoff, idempotency, confirmation), but their documentation lagged behind the code:

| Document | Problem |
|---|---|
| `src/modules/training-plan/README.md` | Conceptual errors: it says the AI responds with "real IDs" (it returns names), it says the WeekLog "is persisted as part of the TrainingPlan" (it is materialized in confirmPlan), it omits `PlanMaterializerService` and the locks, it does not document `comment`, nor the **AI-only** nature of the module |
| `src/modules/ai/README.md` | It is a **June 2026** diagnosis predating the implementation: it marks `plan-generator.prompt.ts` and `parser.ts` as empty, model `llama-3.3-70b-versatile`, `generatePlan` "partial". It does not mention rate limit, retry, or the `AI_CAUSE` taxonomy |
| `documents/analysis/review-ai-plan-generation.md` | Review (2026-08-21) with 6 failures, **all resolved today** (idempotency, output validation, logging, rate limit, retry), marked as "Not implemented" |
| `documents/config/ai.md` | Created today (2026-08-29), reflects the real state, but lists the `createTrainingPlan` mutation (to be removed) |

Additionally, **inherited mutations** remain in `TrainingPlanResolver` that are not used:

- `createTrainingPlan` — the manual route is **broken** (the `TrainingPlan` schema requires `aiSnapshot`, `userProfileId`, `goalId` and the service `create()` does not set them). The `TrainingPlan` is **AI-only**: the manual week/routine is created directly with WeekLog/RoutinePlan, never with a TrainingPlan.
- `removePlan` — **duplicate** of `removeTrainingPlan`. The frontend uses `removeTrainingPlan`:

```graphql
mutation RemoveTrainingPlan($id: String!) {
    removeTrainingPlan(id: $id) {
        id
    }
}
```

---

## Decisions confirmed by the user

| Question | Decision |
|---|---|
| `src/modules/ai/` README (obsolete) | **Rewrite it** as the doc of the **transversal layer** (providers, rate limit, retry, audit, how to consume `AiService`) |
| `createTrainingPlan` (manual, broken) | **Remove it from the code** (mutation + `service.create()` + DTO + spec + dependency of the update-input) |
| `documents/analysis/review-ai-plan-generation.md` | **Update marking what is resolved** point by point (it stays as traceable history) |
| `removePlan` (unused alias) | **Remove it**: the frontend uses `removeTrainingPlan` |
| Final validation | **Run tests** (jest training-plan + ai), build and lint |

---

## Phase A — Code cleanup: remove `createTrainingPlan`

### A.1 `src/modules/training-plan/training-plan.resolver.ts`

- Remove the `createTrainingPlan` block (mutation, ~lines 24-32).
- Remove the `CreateTrainingPlanInput` import (line 11).

### A.2 `src/modules/training-plan/training-plan.service.ts`

- Remove the `create()` method (lines 32-50).
- Remove the `CreateTrainingPlanInput` import (line 4).

### A.3 `src/modules/training-plan/training-plan.service.spec.ts`

- Remove `describe('create', ...)` (lines 68-111) and its cases (date/tag defaults, provided `startDate`).
- Keep the other blocks (`findAll`, `findOne`, `update`, `remove`, `generate`).

### A.4 `src/modules/training-plan/training-plan.resolver.spec.ts`

- Remove `create: jest.fn()` from the `trainingPlanServiceMock` mock (line 15). `remove` stays (used by `removeTrainingPlan`).

### A.5 `src/modules/training-plan/dto/create-training-plan.input.ts`

- **Delete the file.**

### A.6 `src/modules/training-plan/dto/update-training-plan.input.ts`

- Today it depends on the deleted file: `UpdateTrainingPlanInput extends PartialType(CreateTrainingPlanInput)`.
- Rewrite it **self-contained**: define a local base with the same fields (`title`, `description`, `focus`, `durationWeeks`, `trainingDaysPerWeek`, `startDate`, `tags`) and `export class UpdateTrainingPlanInput extends PartialType(BaseInput)`. Without importing the create-input.

> Verified: no references in `test/` or in other modules.

---

## Phase B — Code cleanup: remove `removePlan`

### B.1 `src/modules/training-plan/training-plan.resolver.ts`

- Remove the `removePlan` mutation (lines 102-109).
- `removeTrainingPlan` is kept (single deletion route).

> Verified: `removePlan` has no coverage in specs (no spec references it).
> Confirmed by the user: the frontend uses `removeTrainingPlan`.

---

## Phase C — Validation with tests

Run and require a **green suite**:

```bash
npx jest --config jest.config.js src/modules/training-plan src/modules/ai
npm run build
npm run lint
```

- The `training-plan.service` and `training-plan.resolver` specs must pass after the cleanup.
- Confirm that no broken imports remain after deleting `create-training-plan.input.ts`.
- Check that the autogenerated GraphQL schema build no longer exposes `createTrainingPlan` or `removePlan`.

---

## Phase D — IA-TrainingPlan module documentation (canonical and reusable)

### D.1 Rewrite `src/modules/training-plan/README.md`

Convert it into the **canonical reference of the module and of the "AI-generation module" pattern** (reusable for future modules: multi-week, DayLog, etc.):

1. **Purpose** — TrainingPlan is **AI-only**: it generates a plan with AI and in `confirmPlan` materializes a **WeekLog** (1 week) or a **RoutinePlan** template. There is no manual route (the manual week/routine is created via WeekLog/RoutinePlan CRUD). Neither `createTrainingPlan` nor `removePlan` exist (removed).
2. **Real pipeline**:
   `generatePlan(comment)` → `TrainingPlanService.generate` (lock `userId+comment`) → `PlanGeneratorService.generatePlan` (lock `userId`) → `PlanValidatorService.validate` → snapshot `Goal` → catalog of **unique names** → `buildPlanPrompts` → `AiService.executePrompt` (rate limit + retry) → `PlanGeneratorParser` (JSON 7 days) → `PlanMaterializerService` (names → real ids, exact/folded/subset/levenshtein layers; discard of unresolvable) → persists `TrainingPlan` `draft` + `aiSnapshot` → `confirmPlan(id, action)` materializes and marks `confirmed:true` atomically.
3. **Reusable "AI-generation module" pattern** — 8 generic stages (validate → snapshot input → prompt → LLM call → parse → resolve/materialize → persist draft → confirm) with the **`aiSnapshot` contract** as source of truth for confirming, the `AI_CAUSE` taxonomy, and the points where a new module should replicate (validator, prompt builder, parser, materializer, locks, atomic confirmation).
4. **Correction of the README's current errors**: the AI returns **names** (not IDs); the entities are built **in memory** (not persisted at generation); `generatePlan` receives `comment`; `CREATE_ROUTINE_PLAN` creates RoutineDays **only for training days** (not "7"); `ADAPT_ACTIVE_WEEK` reserved (501); AI-driven `isAiGenerated` in RoutinePlan.
5. **Per-file architecture** (includes `PlanMaterializerService`, `PlanValidatorService`, `ConfirmPlanService`, `PlanGeneratorParser`, locks).
6. **Real GraphQL API**: `generatePlan`, `confirmPlan`, `trainingPlans`, `trainingPlan`, `updateTrainingPlan`, `removeTrainingPlan`.
7. **State and evolution**: today **1 week** per plan; in the future **N weeks/plan**, **DayLog** as confirmation artifact, and new modules replicating the scheme.
8. Env vars and reference to `documents/config/ai.md`.

### D.2 Rewrite `src/modules/ai/README.md`

Doc of the **transversal layer**:
1. Role: `AiService.executePrompt()` = single point of LLM call; registry `'AI_PROVIDERS'` (strategy pattern `IAiProvider`).
2. `GroqProvider`: `openai/gpt-oss-120b`, `temperature: 0`, `reasoningEffort: 'low'`, `maxRetries: 0`, `timeout`/`maxTokens` from env.
3. **Rate limit**: `AiUsage` (UTC window, unique index + 2-day TTL), `AiRateLimitService`, atomic upsert, E11000 retry, `aiUsageStatus`.
4. **Retries**: transience (timeout/network/5xx/429/EMPTY_RESPONSE), backoff with `Retry-After`, global budget, `AI_*` env vars.
5. `AI_CAUSE` taxonomy + audit (`AI_PROMPT_EXECUTED`).
6. **How to consume `AiService` from a new module** (step by step).

### D.3 Update `documents/config/ai.md`

- Section 6 (GraphQL API): remove the `createTrainingPlan(...)` and `removePlan(id)` lines.
- Section 8 (Limitations): rewrite the "AI vs MANUAL origin flag" point → the manual route was **removed**; the module is AI-only and the required `aiSnapshot` is by design. Add a note that `removePlan` (alias) was removed.

### D.4 Update `AGENTS.md`

- Section 9 (GraphQL routes): `TrainingPlan:` → remove `createTrainingPlan,` and `, removePlan`.
- Section 16: keep; it stays aligned (no longer mentions manual).

### D.5 Update `documents/analysis/review-ai-plan-generation.md`

Mark the real status of the 6 points of the executive summary (without deleting the analysis):

| # | Point | Real status 2026-08-29 |
|---|---|---|
| 1 | Idempotency | Resolved: `generating` (userId+comment) + `inFlight` (userId) |
| 2 | Validation on modification | Partial: materializer discards/validates names against catalog; `@Max` on `comment` still pending |
| 3 | Cause logging | Resolved: Loggers + audit + raw content truncated (500 chars) |
| 4 | Per-user rate limit | Resolved: `AiUsage` + `AiRateLimitService` |
| 5 | AI vs MANUAL flag | Resolved by design: manual route removed; TrainingPlan AI-only (RoutinePlan keeps `isAiGenerated`) |
| 6 | Retry/backoff/timeout | Resolved: external loop with budget + `maxRetries:0` in SDK |

Add a date banner and a pointer to `documents/config/ai.md` and to the training-plan README as the current source.

---

## Files affected (summary)

| File | Action |
|---|---|
| `src/modules/training-plan/training-plan.resolver.ts` | Edit (remove `createTrainingPlan` and `removePlan`) |
| `src/modules/training-plan/training-plan.service.ts` | Edit (remove `create()`) |
| `src/modules/training-plan/training-plan.service.spec.ts` | Edit (remove `create` block) |
| `src/modules/training-plan/training-plan.resolver.spec.ts` | Edit (remove `create` mock) |
| `src/modules/training-plan/dto/create-training-plan.input.ts` | **Delete** |
| `src/modules/training-plan/dto/update-training-plan.input.ts` | Rewrite self-contained |
| `src/modules/training-plan/README.md` | **Rewrite** (canonical + reusable pattern) |
| `src/modules/ai/README.md` | **Rewrite** (transversal layer) |
| `documents/config/ai.md` | Edit (routes + limitations) |
| `AGENTS.md` | Edit (section 9) |
| `documents/analysis/review-ai-plan-generation.md` | Edit (resolved states + banner) |

---

## Execution order

A (remove `createTrainingPlan`) → B (remove `removePlan`) → C (tests/build/lint green) → D (documentation with the final state of the code).

> **Out of scope:** `updateTrainingPlan` and `removeTrainingPlan` are kept. The generation/confirmation flow (already correct) is not touched.