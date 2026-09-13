# Plan: Modify an AI-generated plan (`modifyPlan`)

> **Status:** Historical / Non-Authoritative
> **Spec:** `sdd/training-plan.spec.md`

## Status

Implementation **complete and validated**:
- `npm run build` ok · `npm run lint` (0 errors) ok · `npm test` full suite (61 suites / 602 tests) ok
- `npm run test:e2e` full suite (24 suites / 130 tests) ok
- Mutation `modifyPlan(id, comment)` exposed, with `PlanModifierService` registered.
- E2E for the modification: **implemented** (`test/e2e/training-plan/modify-plan.spec.ts`, 4 cases).

The authoritative contract for this feature is consolidated in the Spec `sdd/training-plan.spec.md`. This plan is kept for traceability and historical review only.

---

## Purpose

The project already has a complete AI generation pipeline (`generatePlan` → `PlanGeneratorService`) that stores everything needed in `aiSnapshot` (user context, used prompt, plan `rawResponse`). There is currently **no functionality** for the user to modify a generated plan: the `comment` is only accepted in the initial generation.

This feature implements the `modifyPlan(id, comment)` mutation that reuses the existing pipeline, but instead of generating from scratch, it re-sends to the AI: **the current plan + the user context + the change comment**, and overwrites the **same** `TrainingPlan` document with the new result.

---

## Design decisions (confirmed with the user)

| Decision | Choice |
|---|---|
| **Strategy** | Overwrite the **same** `TrainingPlan` document: updates `aiSnapshot`, `rawResponse`, metadata and `version + 1`. NO new documents are created. |
| **Modifiable plans** | Drafts (`draft`) and active unconfirmed plans (`confirmed: false`). Confirmed ones are rejected with `ConflictException`. |
| **Data sent to the prompt** | The **parsed current plan** + the **user context** + the **change comment** are sent to the AI. |

### Assumption pending to confirm

When modifying, either can be used:
- **(a) CURRENT profile context** (fresh, via `buildUserContextForAI`), consistent with re-materialization against the current catalog — **IMPLEMENTED (chosen option)**.
- (b) Context of the **original snapshot** (`aiSnapshot.contextSentToAI`), for maximum fidelity to the original generation.

> **Final decision:** option (a) was implemented — current/fresh profile context.

---

## File Impact

| File | Action |
|---|---|
| `plan-generator/plan-generator.prompt.ts` | Refactor: extract reusable `systemPrompt` |
| `plan-modifier/plan-modifier.prompt.ts` | **New** — `buildModifyPlanPrompts` |
| `plan-modifier/plan-modifier.service.ts` | **New** — AI modification logic + lock |
| `plan-modifier/plan-modifier.prompt.spec.ts` | **New** — tests |
| `plan-modifier/plan-modifier.service.spec.ts` | **New** — tests |
| `training-plan.service.ts` | Add `modify()` |
| `training-plan.resolver.ts` | Add `modifyPlan` mutation |
| `training-plan.module.ts` | Register `PlanModifierService` |
| `training-plan.service.spec.ts` / `resolver.spec.ts` | Extend tests |
| `README.md` (training-plan) | Document `modifyPlan` |

---

## New GraphQL routes

```
TrainingPlan:
  modifyPlan(id: String!, comment: String!) -> TrainingPlan   # modifies the current plan (same doc, version+1)
```

No new env vars required (reuses `AiService.executePrompt` with the same rate limit `AI_DAILY_LIMIT`).

---

## Implementation phases

### Phase 1 — Prompt refactor (reusable systemPrompt)

**Goal:** avoid duplicating the coach-rules body + expected JSON output structure between generation (`generatePlan`) and modification (`modifyPlan`). Extract the current `systemPrompt` into an exported reusable function so both operations produce **exactly the same output format** (parseable by `PlanGeneratorParser`).

**File:** `src/modules/training-plan/plan-generator/plan-generator.prompt.ts`

**Changes:**

1. Extract the `systemPrompt` text (coach rules + `EXPECTED JSON STRUCTURE` + `IMPORTANT`) from the `buildPlanPrompts` function into a new exported function:

```ts
export function buildPlanSystemPrompt(): string {
  const lines = [
    'Eres un preparador físico experto con más de 10 años de experiencia.',
    // ... (the full current content of systemPrompt)
  ];
  return lines.join('\n');
}
```

2. Inside `buildPlanPrompts`, replace the inline `systemPrompt` assembly with:

```ts
const systemPrompt = buildPlanSystemPrompt();
```

3. The `userPrompt` of `buildPlanPrompts` is **not touched**.

**Expected result:**

- `buildPlanPrompts(aiContext, exerciseNames, comment)` keeps returning `{ systemPrompt, userPrompt }` with the SAME output as before (no regression).
- `buildPlanSystemPrompt()` becomes available for Phase 2.

**Verification:**

- `npx jest --config jest.config.js src/modules/training-plan/plan-generator/plan-generator.prompt.spec.ts`
- The existing prompt test must still pass unchanged.

---

### Phase 2 — Modification prompt (`buildModifyPlanPrompts`)

**Goal:** create the prompt builder specific to the **modification** of a plan: it sends the AI the **current plan** (so it knows what to change), the **user context**, and the **change comment**. It must reuse the same `systemPrompt` extracted in Phase 1 to guarantee an output format identical to `generatePlan`.

**File:** `src/modules/training-plan/plan-modifier/plan-modifier.prompt.ts` (NEW)

**Signature:**

```ts
export function buildModifyPlanPrompts(
  aiContext: Record<string, unknown>,   // user context (current or from the snapshot)
  exerciseNames: string[],              // unique exercise catalog
  currentPlan: Record<string, any>,     // current ParsedPlan (what will be modified)
  comment: string,                      // what the user wants to modify
): { systemPrompt: string; userPrompt: string }
```

**Implementation:**

- `systemPrompt = buildPlanSystemPrompt()` (imported from `plan-generator.prompt`).
- `userPrompt` composed of sections:

```
Modifica el siguiente plan de entrenamiento según la petición del usuario.
Debes devolver el plan COMPLETO actualizado en el mismo formato JSON de 7 días, no solo el cambio.

--- PLAN ACTUAL ---
{JSON.stringify(currentPlan)}          # compact, without indentation (token savings)

--- DATOS DEL USUARIO ---
{JSON.stringify(aiContext)}

--- CATÁLOGO DE EJERCICIOS DISPONIBLES ---
Usa SOLO estos ejercicios. Copia el nombre EXACTAMENTE como aparece en la lista:
- {name}
...

--- PREFERENCIA DE MODIFICACIÓN DEL USUARIO ---
{comment.trim()}

Devuelve SOLO el objeto JSON completo (7 días), sin explicaciones, sin notas adicionales, sin marcas de código.
```

**Rules to respect:**

- The output JSON must contain **exactly 7 days** and the complete plan structure (`title`, `focus`, `durationWeeks`, `daysPerWeek`, `days[]`).
- The AI must preserve the structure and only apply the changes requested by `comment`.
- Exercise names must be copied exactly from the catalog (identical rule to generation).

**Verification:**

- `plan-modifier.prompt.spec.ts` (Phase 5) verifies that the userPrompt includes: "PLAN ACTUAL", the `JSON.stringify(currentPlan)`, "DATOS DEL USUARIO", the catalog and the `comment`.

---

### Phase 3 — AI modification service (`PlanModifierService`)

**Goal:** orchestrate the AI call to modify an existing plan, reusing the `PlanGeneratorService` pipeline (validation → context → prompt → parse → materialize → audit), but building the prompt from the **current plan**.

**File:** `src/modules/training-plan/plan-modifier/plan-modifier.service.ts` (NEW)

**Injected dependencies (same as `PlanGeneratorService`):**

- `UserProfileService`
- `AiService`
- `PlanValidatorService`
- `PlanGeneratorParser`
- `ExerciseService`
- `AuditLogsService`
- `PlanMaterializerService`
- `@InjectModel(Goal.name)` — for the goal snapshot (optional, see note)

**Signature:**

```ts
async modifyPlan(
  userId: string,
  plan: TrainingPlan,   // current document to modify
  comment: string,
): Promise<GeneratePlanResult>
```

**Flow:**

1. **Validate profile** — `planValidator.validate(userId)`; if invalid → `BadRequestException` as in `generatePlan`.
2. **Get profile + context** — `userProfileService.getFullProfileContext(userId)` → `buildUserContextForAI(profile)`. *(Assumption: CURRENT/fresh context. If the snapshot's is preferred: `plan.aiSnapshot.contextSentToAI`.)*
3. **Unique catalog** — `materializer.buildUniqueCatalogNames(userId, exercises)` via `exerciseService.findAll()`.
4. **Current plan** — re-parse the current snapshot: `currentPlan = parser.parseWithRawJson(JSON.stringify(plan.aiSnapshot.rawResponse)).plan`.
5. **Modification prompt** — `buildModifyPlanPrompts(aiContext, exerciseNames, currentPlan, comment)`.
6. **AI call** — `aiService.executePrompt({ providerName, systemPrompt, userPrompt, userId })`.
7. **Parse** — `parser.parseWithRawJson(rawContent)` → `{ plan, rawJson }`.
8. **Materialize** — `materializer.materializeWeekLog(userId, parsedPlan)` (resolves names → ids against the current catalog).
9. **Focus** — `resolveFocus(parsedPlan.focus, aiContext)` (same logic as `PlanGeneratorService`).
10. **Audit** — `TRAINING_PLAN_MODIFIED` with `success` and metadata (title, focus, tokens, durationMs); failure log with `cause` in the `catch`.

**Idempotency lock:**

- Add `private readonly inFlight = new Map<string, { comment: string; promise: Promise<GeneratePlanResult> }>()` keyed by `userId`, **identical** to `PlanGeneratorService.inFlight`.
- Thus, a concurrent modification with a different comment throws `ConflictException` and duplicate AI calls are avoided. Ideally, `modifyPlan` and `generatePlan` share the same conceptual per-`userId` lock (only one AI operation in progress per user).

> **Note on Goal snapshot:** `generatePlan` creates a `Goal` document as context audit. For `modifyPlan`, since the context changes, a new Goal can be created or the plan's can be reused if snapshot fidelity is kept. Recommended: create a new Goal with the used `contextSnapshot` (consistent with the fresh-context assumption).

**Verification:**

- `plan-modifier.service.spec.ts` (Phase 5): verifies it uses `buildModifyPlanPrompts`, calls `executePrompt`, re-parses the snapshot, materializes and builds the `aiSnapshot` correctly.

---

### Phase 4 — Service + Resolver + Module (exposing `modifyPlan`)

**Goal:** expose the modification via GraphQL, orchestrated from `TrainingPlanService.modify()`, and register `PlanModifierService` in the module.

**Files:**

1. `src/modules/training-plan/training-plan.service.ts`
2. `src/modules/training-plan/training-plan.resolver.ts`
3. `src/modules/training-plan/training-plan.module.ts`

**1) `TrainingPlanService.modify()`**

```ts
async modify(userId: string, id: string, comment: string): Promise<TrainingPlan> {
  // a) Find the plan by _id + userId (scope). If not found → NotFoundException.
  // b) Validate modifiable: if (plan.confirmed) → ConflictException('El plan ya fue confirmado').
  // c) result = await this.modifier.modifyPlan(userId, plan, comment);  (Phase 3)
  // d) Overwrite the SAME document:
  //      - aiSnapshot: result.aiSnapshot
  //      - title: result.metadata.title
  //      - focus: result.metadata.focus
  //      - durationWeeks: result.metadata.durationWeeks
  //      - trainingDaysPerWeek: result.metadata.daysPerWeek
  //      - startDate: result.weekLog.startDate
  //      - endDate: startDate + durationWeeks*7
  //      - version: (plan.version ?? 1) + 1
  //    Use findOneAndUpdate({_id, userId}, {$set: {...}}, {new: true}) or
  //    update the plan object and plan.save().
  // e) normalizePlanFocus(plan.focus) and return the updated plan.
}
```

> **Note on re-materialization at confirmation:** by overwriting `aiSnapshot.rawResponse`, `ConfirmPlanService.confirmAsWeekLog` / `confirmAsRoutinePlan` re-parse and re-materialize against the current catalog. No additional changes required.

**2) `TrainingPlanResolver` — mutation**

```ts
@Mutation(() => TrainingPlan, { name: 'modifyPlan' })
async modifyPlan(
  @Args('id', { type: () => String }) id: string,
  @Args('comment', { type: () => String }) comment: string,
  @Context() context,
) {
  const userId = extractUserId(context);
  return this.trainingPlanService.modify(userId, id, comment);
}
```

**3) `TrainingPlanModule` — registration**

- Add `PlanModifierService` to the `providers` array.
- Inject `PlanModifierService` in the `TrainingPlanService` constructor.

**Verification:**

- Resolver exposes `modifyPlan` and delegates to `trainingPlanService.modify` with the extracted `userId`.
- `TrainingPlanService.modify` updates the same document, increments `version`, rejects confirmed ones.
- `npm run build` without type errors.

---

### Phase 5 — Unit and E2E tests

**Goal:** cover the new functionality replicating the existing test patterns (`plan-generator.prompt.spec.ts`, `plan-generator.service.spec.ts`, `confirm-plan.service.spec.ts`) and the E2E pattern of `test/e2e/`.

**New unit tests:**

`plan-modifier/plan-modifier.prompt.spec.ts`
- The `userPrompt` includes `--- PLAN ACTUAL ---` and the `JSON.stringify(currentPlan)`.
- Includes `--- DATOS DEL USUARIO ---` with the `aiContext`.
- Includes `--- PREFERENCIA DE MODIFICACIÓN DEL USUARIO ---` with the trimmed `comment`.
- Includes the catalog (`--- CATÁLOGO DE EJERCICIOS DISPONIBLES ---` and the names).
- The `systemPrompt` is `buildPlanSystemPrompt()` (matches the generation).

`plan-modifier/plan-modifier.service.spec.ts`
- Happy flow: validates profile → gets context → re-parses the plan snapshot → calls `executePrompt` with `buildModifyPlanPrompts` → parse → materializes → builds `aiSnapshot` → audits `TRAINING_PLAN_MODIFIED` with success.
- Failure: if `executePrompt` throws, audits with success:false and re-throws.
- Lock: an in-progress modification with a different comment → `ConflictException`.

**Extended unit tests:**

`training-plan.service.spec.ts`
- `modify`: updates the SAME `TrainingPlan` document, increments `version` to `+1`, updates `aiSnapshot`/metadata/dates.
- `modify` on a confirmed plan → `ConflictException`.
- `modify` of a nonexistent/not-owned plan → `NotFoundException`.

`training-plan.resolver.spec.ts`
- `modifyPlan(id, comment, context)` delegates to `trainingPlanService.modify(userId, id, comment)`.

**E2E tests (recommended):**

In `test/e2e/` (e.g. `modify-plan.e2e-spec.ts`):
1. Create user + full profile.
2. `generatePlan` (mock AI) → get draft.
3. `modifyPlan(id, 'cambiar el día 2 por empuje')` (mock AI with new JSON) → verify `version` incremented and `aiSnapshot.rawResponse` updated.
4. `confirmPlan(id, CREATE_WEEK_LOG)` → the artifact is created from the **modified** plan.
5. Negative case: modifying a confirmed plan → error.

**Commands:**

```bash
npm test
npm run test:e2e
```

---

### Phase 6 — Final validation and documentation

**Goal:** verify everything compiles, passes lint and tests, and update the canonical documentation of the module.

**Verification commands:**

```bash
npm run build        # compile TypeScript
npm run lint         # ESLint
npm run format       # Prettier
npm test             # unit tests
npm run test:e2e     # end-to-end tests
```

**Documentation:**

Update `src/modules/training-plan/README.md`:

- Add the `modifyPlan(id, comment)` mutation to the `API GraphQL` section.
- Explain the contract: overwrites the same document, increments `version`, only on unconfirmed plans.
- Document the chosen context assumption (current vs snapshot).
- Add `plan-modifier/` to the `Per-file architecture` section.

> Per `AGENTS.md` §12: "Before modifying authentication, tracking or IA code, read the reference documents." The implementation touches `training-plan` (which uses AI), so `documents/config/ai.md` must be reviewed before executing this feature.

**Completion criterion:**

- `build` ok, `lint` ok, `test` green (including the new `plan-modifier` specs).
- `modifyPlan` exposed and working in the GraphQL schema.
- `training-plan` README updated.