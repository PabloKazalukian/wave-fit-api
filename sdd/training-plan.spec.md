# Training Plan (AI Plan Generation and Confirmation)

> **Status:** Done (implemented and validated)
> **Priority:** high

## Context

The `training-plan` module generates **personalized training plans with AI**. It is a **solo-AI** module by design: a `TrainingPlan` is created exclusively via `generatePlan`; there is no manual creation path (the `createTrainingPlan` mutation and `createTrainingPlan.input.ts` were removed; deletion is only via `removeTrainingPlan`). The AI model returns **exercise names, not ids**, and nothing is persisted in `generatePlan` except the `TrainingPlan` draft (`status: draft`, `confirmed: false`, required `aiSnapshot`). The week or routine is materialized only at `confirmPlan`. See `documents/modules/training-plan.md` and `documents/modules/ai.md`.

## Requirements

### Functional Requirements

- `FR-001` — `generatePlan(comment)` validates the user profile via `PlanValidatorService` before spending AI quota, builds the prompt (`buildPlanPrompts`), calls the LLM through the single transversal entry point `AiService.executePrompt`, parses the response, materializes a `WeekLogDomain` + `WorkoutSessionCreationData[]` **in memory**, and persists the `TrainingPlan` draft with `aiSnapshot` (context sent, prompt used, model used, raw JSON response, tokens used, generatedAt). Real `WeekLog`/`WorkoutSession`/`RoutinePlan` documents are never persisted here.
- `FR-002` — The AI response is strict JSON for exactly 7 days parsed by `PlanGeneratorParser.parseWithRawJson`; on invalid JSON the parser logs the **full raw response** via `Logger.error`, prefixed with the `AI_MALFORMED_JSON` cause (`plan-generator.parser.ts:47-50`), and responds `400 BadRequestException` with a plain-text message (no machine-readable `code` field on the body).
- `FR-003` — The AI returns **exercise NAMES**; `PlanMaterializerService.resolveAgainstCatalog` resolves each name against the real catalog in layers: L1 `exact` (normalized equality) → L2 `folded` (singular/plural folding) → L3 `subset` (token subset, most specific wins, ties are ambiguous) → L4 `levenshtein` (bounded distance, blocked by opposite-word detection).
- `FR-004` — Unresolvable names are **discarded with a warning** (an AI invention does not fail the plan); if a day ends without exercises it becomes `isRest: true`; if **no** exercise resolves at all, the generation fails `400` with cause `AI_UNKNOWN_EXERCISE_NAME` and suggestions.
- `FR-005` — `confirmPlan(id, action)` materializes the plan against the **current catalog at confirmation time** and executes one of `PlanConfirmationAction`: `create_week_log` (creates an active `WeekLog` + its `WorkoutSession`s; `ConflictException` `409` if the user already has an active week), `create_routine_plan` (creates a `RoutinePlan` template without weights, `RoutineDay`s only for training days — `isRest` and empty days discarded — with `isAiGenerated: true` and `generatedFromPlanId`; `400` if there are no training days), `adapt_active_week` (**reserved**, returns `501 Not Implemented`).
- `FR-006` — Confirmation is **atomic**: `markConfirmed()` uses `findOneAndUpdate({ confirmed: false })`; a second confirmation of the same plan throws `409`. On success the plan is marked `confirmed: true`, `status: active`, with `confirmedAction` and the created artifact ids (`resultingWeekLogId` / `resultingRoutinePlanId`).
- `FR-007` — `modifyPlan(id, comment)` modifies a plan that is still `confirmed: false`: it resends the AI the current plan + user context + comment, and **overwrites the same `TrainingPlan` document** (updates `aiSnapshot`, metadata, dates, `version + 1`). It throws `ConflictException` if the plan was already confirmed. It reuses `buildPlanSystemPrompt()` to keep the same JSON output contract.
- `FR-008` — **Idempotency locks (single-node, in-memory)**: `TrainingPlanService.generating` keyed `userId::comment` deduplicates the persisted plan (same comment returns the same plan); `PlanGeneratorService.inFlight` keyed `userId` deduplicates the AI call (a different comment while in flight throws `ConflictException` 409). The same locking pattern protects `modifyPlan`.
- `FR-009` — CRUD/read surface: `trainingPlans(limit, offset)` (paginated), `trainingPlan(id)`, `updateTrainingPlan(updateTrainingPlanInput)`, `removeTrainingPlan(id)` — the only removal path. All operations are user-scoped and protected with `GqlAuthGuard`.
- `FR-010` — Audit: each generation, modification and confirmation records an audit log (`TRAINING_PLAN_GENERATED`, `TRAINING_PLAN_MODIFIED`, `TRAINING_PLAN_CONFIRMED`) following the same pattern as `AI_PROMPT_EXECUTED`.
- `FR-011` — `PlanFocus` enum: `fat_loss | muscle_gain | strength | endurance | maintenance | recomp`; `resolveFocus()` accepts the AI value if valid, otherwise derives from the goal `primary`, otherwise defaults to `maintenance`; legacy values are normalized on read.

### Business Rules

- `BR-001` — A `TrainingPlan` only exists if it came from the AI (sole-draft requirement, `aiSnapshot` is `required: true`).
- `BR-002` — `confirmPlan` on a plan that is not owned by the caller or that does not exist is rejected; a confirmed plan can never be re-confirmed (atomic guard).
- `BR-003` — A `TrainingPlan` is never the week itself: the tracking week or template routine is created directly through the WeekLog/RoutinePlan CRUD paths (distinguished by `isAiGenerated`/`generatedFromPlanId`), not through the plan.

### Non-Functional Requirements

- `NFR-001` — `AiService.executePrompt` is the **only** point that calls the LLM: daily per-user rate limit (fixed window UTC, `AI_DAILY_LIMIT`, cause `RATE_LIMIT_EXCEEDED`), retry with backoff and global budget (`AI_MAX_ATTEMPTS`, `AI_TOTAL_BUDGET_MS`) for transient errors only (`AI_PROVIDER_ERROR`, `AI_EMPTY_RESPONSE`); `ChatGroq` is configured with `maxRetries: 0` so retries are not nested.
- `NFR-002` — Prompt JSON contract is kept stable between `generatePlan` and `modifyPlan` by sharing `buildPlanSystemPrompt()`.
- `NFR-003` — In-memory locks are valid for single-node deploys only; the locking points are documented for a future Mongo-TTL migration.
- `NFR-004` — All dates derived from the user's `LocalDate` use the tracking default timezone `'America/Argentina/Buenos_Aires'`.

## Constraints

- Do not reintroduce a manual `createTrainingPlan` path or the `service.create()` / `create-training-plan.input.ts` files.
- Do not persist the in-memory week/sessions in `generatePlan`; persistence happens only in `confirmPlan`.
- Do not cache AI results between calls from the same user.
- Do not bypass `AiService.executePrompt` when calling the LLM from any consumer.
- Do not add a second parser/materializer implementation; reuse `PlanGeneratorParser` and `PlanMaterializerService`.

## Architecture

Reusable 8-stage pipeline ("AI generation module" pattern) for the current feature:

| Etapa | Pieza | TrainingPlan |
|---|---|---|
| 1. Validate | `PlanValidatorService` | Profile completeness: `missing` blocks (UserProfile birthDate/heightCm/weightKg, UserGoal primaryGoal/trainingExperience, UserSchedule daysPerWeek/preferredDays); `recommended` does not block (UserResource, UserTrainingPreference, UserStrengthMetric). Response `400` with `missing[]` / `recommended[]`. |
| 2. Snapshot | `GoalModel.create({ contextSnapshot })` | Goal snapshot before the AI call (audit; orphan goals on failure are acceptable). |
| 3. Build prompt | `buildPlanPrompts(aiContext, exerciseNames, comment)` | `PlanMaterializerService.buildUniqueCatalogNames` sends unique names only; `comment` appended as extra preference. |
| 4. Call AI | `AiService.executePrompt` | Rate limit + provider + retry/backoff (only LLM entry point). |
| 5. Parse | `PlanGeneratorParser.parseWithRawJson` | Strict 7-day JSON; `AI_MALFORMED_JSON` on invalid. |
| 6. Materialize | `PlanMaterializerService.materializeWeekLog` | Resolves names → real ids (exact/folded/subset/levenshtein); builds `WeekLogDomain` + sessions in memory. |
| 7. Persist draft | `TrainingPlan` | `status: draft`, `confirmed: false`, required `aiSnapshot`. |
| 8. Confirm | `ConfirmPlanService` | Re-parses/re-validates snapshot, re-materializes against current catalog, executes action, atomic `findOneAndUpdate({ confirmed: false })`. |

Key idempotency layers: `TrainingPlanService.generating` (`userId::comment`) and `PlanGeneratorService.inFlight` (`userId`); `plan-modifier` mirrors them with its own in-memory lock.

## Files

- `src/modules/training-plan/training-plan.module.ts` (wiring, exports `TrainingPlanService`)
- `src/modules/training-plan/training-plan.resolver.ts` (GraphQL, `GqlAuthGuard`)
- `src/modules/training-plan/training-plan.service.ts` (facade: `generate` lock `userId::comment` + `findAll`/`findOne`/`update`/`remove`)
- `src/modules/training-plan/schema/training-plan.schema.ts` (`TrainingPlan`, enums `PlanStatus`, `PlanFocus`, `PlanConfirmationAction`, `normalizePlanFocus`)
- `src/modules/training-plan/schema/ai-snapshot.schema.ts` (embedded `AiSnapshot`)
- `src/modules/training-plan/schema/goal.schema.ts`
- `src/modules/training-plan/entities/` and `src/modules/training-plan/dto/update-training-plan.input.ts`
- `src/modules/training-plan/plan-validator/plan-validator.service.ts`
- `src/modules/training-plan/plan-generator/{plan-generator.service.ts, plan-generator.prompt.ts, plan-generator.parser.ts}`
- `src/modules/training-plan/plan-modifier/{plan-modifier.service.ts, plan-modifier.prompt.ts}`
- `src/modules/training-plan/plan-materializer/plan-materializer.service.ts`
- `src/modules/training-plan/plan-confirmation/confirm-plan.service.ts` (+ `entities/confirm-plan.output.entity.ts`)

## Tests

- `TEST-001` — Unit: `src/modules/training-plan/plan-generator/plan-generator.parser.spec.ts` covers strict 7-day JSON parsing, type normalization, `AI_MALFORMED_JSON`.
- `TEST-002` — Unit: `src/modules/training-plan/plan-generator/plan-generator.prompt.spec.ts` covers `buildPlanPrompts` (context + unique names + comment) and `buildPlanSystemPrompt` stability.
- `TEST-003` — Unit: `src/modules/training-plan/plan-generator/plan-generator.service.spec.ts` covers the `userId` in-flight lock, orchestration and audit.
- `TEST-004` — Unit: `src/modules/training-plan/plan-materializer/plan-materializer.service.spec.ts` covers resolution layers exact/folded/subset/levenshtein, opposite-word blocking, name discard and `AI_UNKNOWN_EXERCISE_NAME`.
- `TEST-005` — Unit: `src/modules/training-plan/plan-validator/plan-validator.service.spec.ts` covers `missing` vs `recommended` fields and the `400` payload.
- `TEST-006` — Unit: `src/modules/training-plan/plan-modifier/{plan-modifier.service.spec.ts, plan-modifier.prompt.spec.ts}` covers unconfirmed-only modification, `version + 1`, `ConflictException` on confirmed plans.
- `TEST-007` — Unit: `src/modules/training-plan/plan-confirmation/confirm-plan.service.spec.ts` covers the three actions, atomic double-confirmation rejection, artifact ids and audits.
- `TEST-008` — Unit: `src/modules/training-plan/training-plan.service.spec.ts` and `training-plan.resolver.spec.ts` cover the facade/CRUD surface and the `userId::comment` generation lock.
- `TEST-009` — E2E: `test/e2e/training-plan/generate-plan.spec.ts` covers minimum-data validation, generation with a basic profile, idempotency/concurrency (same comment → same plan; different comment while in-flight → 409) and AI-response validation.
- `TEST-010` — E2E: `test/e2e/training-plan/modify-plan.spec.ts` covers `modifyPlan` (version increments, unconfirmed-only, rejection after confirm and for unknown ids). Delivered via mocked AI provider.
- `TEST-011` — Full canonical gate green: `npm run build`, `npm run lint`, `npm test`, `npm run test:e2e`. Targeted run: `npx jest --config jest.config.js src/modules/ai src/modules/training-plan`.

## Acceptance Criteria

- `AC-001` — `generatePlan` never persists a week or routine; only a `TrainingPlan` draft with required `aiSnapshot` exists after generation.
- `AC-002` — `confirmPlan` with `create_week_log` creates an active week + sessions (409 with an existing active week); with `create_routine_plan` creates a routine template with `isAiGenerated: true` only for training days; `adapt_active_week` returns 501.
- `AC-003` — A plan can be confirmed exactly once; any re-confirmation is rejected atomically.
- `AC-004` — `modifyPlan` updates the same document, increments `version`, and is rejected for confirmed plans.
- `AC-005` — Concurrent `generatePlan` calls with the same comment return the same plan; concurrent calls with different comments are rejected with 409.
- `AC-006` — Exercise names from the AI resolve through the four materializer layers; unresolvable names are discarded and a fully-unresolved plan fails with `AI_UNKNOWN_EXERCISE_NAME`.
- `AC-007` — The canonical verification workflow passes and both `src/modules/training-plan/**` unit suites and `test/e2e/training-plan/` are green.