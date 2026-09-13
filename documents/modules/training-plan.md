# Training Plan Module - AI-powered Plan Generation

> Part of the stable module documentation. Specs live under `sdd/`; this document describes the implemented system state.
> **Status:** Current
> **Last updated:** 2026-09-12

> **Feature contract:** `sdd/training-plan.spec.md`.

> **SOLO-IA module.** A `TrainingPlan` is created exclusively via `generatePlan` (AI). **There is no** manual creation route: the tracking week or the manual routine is created directly with the WeekLog/RoutinePlan CRUD, never with a TrainingPlan. The `createTrainingPlan` mutation and the `removePlan` alias were **removed** (use `removeTrainingPlan`).

## Purpose

`generatePlan(comment)` builds a personalized training plan with AI. In `confirmPlan(id, action)` the result is **materialized** into a real artifact:

- `confirmPlan(..., CREATE_WEEK_LOG)` -> creates a `WeekLog` (1 week) with its `WorkoutSession`s.
- `confirmPlan(..., CREATE_ROUTINE_PLAN)` -> creates a `RoutinePlan` template (no weights) with `RoutineDay`s only for training days.
- `confirmPlan(..., ADAPT_ACTIVE_WEEK)` -> **reserved** (501, not implemented yet).

The AI **does not return IDs**, it returns **exercise names**. Nothing is persisted in `generatePlan` except the `TrainingPlan` itself (`draft`); the WeekLog and sessions are built **in memory** and only materialized at confirmation.

## Pipeline

```
generatePlan(comment)
  └─ TrainingPlanService.generate(userId, comment)     [lock userId+comment]
       └─ PlanGeneratorService.generatePlan(userId, comment)   [lock userId]
            ├─ PlanValidatorService.validate(userId)   -> validates full profile
            ├─ UserProfileService.getFullProfileContext(userId) -> 8 sub-docs
            ├─ buildUserContextForAI(profile)          -> JSON for the prompt
            ├─ GoalModel.create({ contextSnapshot })   -> goal snapshot
            ├─ ExerciseService.findAll()                -> full catalog
            ├─ PlanMaterializerService.buildUniqueCatalogNames(exercises)
            │        -> UNIQUE names (no ids or categories) for the prompt
            ├─ buildPlanPrompts(aiContext, exerciseNames, comment)
            │        -> systemPrompt + userPrompt (+ user comment)
            ├─ AiService.executePrompt({ provider, system, user, userId })
            │        -> rate limit + retry/backoff (see documents/modules/ai.md)
            ├─ PlanGeneratorParser.parseWithRawJson(rawContent)
            │        -> ParsedPlan { title, focus, durationWeeks, daysPerWeek, days[7] }
            ├─ PlanMaterializerService.materializeWeekLog(userId, parsedPlan)
            │        -> resolves names to real ids (exact/folded/subset/levenshtein layers)
            │        -> builds WeekLogDomain + WorkoutSessions IN MEMORY (startDate=today)
            └─ persists TrainingPlan { status: draft, confirmed: false, aiSnapshot }
```

**`confirmPlan(id, action)`**:
1. Finds the plan by `_id` + `userId` (per-user scope).
2. Rejects double confirmation **atomically** (`findOneAndUpdate({ confirmed: false })`).
3. Recovers the `ParsedPlan` from `plan.aiSnapshot.rawResponse` (re-parses and re-validates it).
4. Re-materializes against the **current catalog** at confirmation time.
5. Executes the action: creates WeekLog or RoutinePlan (see above).
6. Marks `confirmed: true`, `status: ACTIVE`, `confirmedAction` and the link to the created artifact (`resultingWeekLogId` / `resultingRoutinePlanId`).
7. Audits `TRAINING_PLAN_CONFIRMED`.

## Reusable pattern: "AI generation module"

This is the template to replicate in future generation modules (multi-week plans, DayLog, etc.):

| Stage | Piece | Current TrainingPlan |
|---|---|---|
| 1. Validate input | `PlanValidatorService` | Validates profile + goal + schedule (missing fields block; recommended do not) |
| 2. Input snapshot | `Goal` model | `GoalModel.create({ contextSnapshot })` for auditing |
| 3. Build prompt | `buildPlanPrompts` | Context + unique catalog names + `comment` |
| 4. AI call | `AiService.executePrompt` | Single LLM call point (rate limit + retry) |
| 5. Parse | `PlanGeneratorParser` | Validated JSON (7 days, typed structure), errors with `AI_MALFORMED_JSON` |
| 6. Resolve/Materialize | `PlanMaterializerService` | AI names to real ids; unresolvable ones dropped; in-memory entity build |
| 7. Persist draft | `TrainingPlan` | `status: draft`, `confirmed: false`, with `aiSnapshot` |
| 8. Confirm | `ConfirmPlanService` | Chosen action; atomic `findOneAndUpdate({ confirmed:false })` |

**`aiSnapshot` contract** (source of truth for confirming). Records what was sent/resolved: `contextSentToAI`, `promptUsed`, `modelUsed`, `rawResponse` (the raw JSON), `tokensUsed`, `generatedAt`.

**Error taxonomy** (`AI_CAUSE`): `AI_PROVIDER_ERROR`, `AI_MALFORMED_JSON`, `AI_EMPTY_RESPONSE`, `AI_UNKNOWN_EXERCISE_NAME`, `RATE_LIMIT_EXCEEDED`.

Points a new module should replicate: a validator, a prompt builder, a parser, a materializer, **idempotency locks** (in-memory by `userId` and by `userId+comment`) and **atomic confirmation**.

## Architecture by file

```
src/modules/training-plan/
├── training-plan.module.ts            # Module wiring (exports ConfirmPlanService)
├── training-plan.resolver.ts          # GraphQL Queries/Mutations (JWT guard)
├── training-plan.service.ts           # Facade: generate (lock userId+comment) + findAll/findOne/update/remove
├── schema/
│   ├── training-plan.schema.ts        # TrainingPlan + enums (PlanStatus, PlanFocus, PlanConfirmationAction)
│   │                                  #   + normalizePlanFocus() (legacy mapping)
│   └── ai-snapshot.schema.ts          # Embedded AiSnapshot (context/prompt/model/raw/tokens)
├── entities/                          # GraphQL output types (TrainingPlan, AiSnapshot, Goal...)
├── dto/
│   └── update-training-plan.input.ts  # Only CRUD input (self-contained); no create-training-plan.input
├── plan-validator/
│   └── plan-validator.service.ts      # Validates full profile; returns missing/recommended
├── plan-generator/
│   ├── plan-generator.service.ts      # Lock userId; orchestrates validation->prompt->AI->parse->materialize
│   ├── plan-generator.prompt.ts       # buildPlanSystemPrompt() (reusable) + buildPlanPrompts(...)
│   ├── plan-generator.parser.ts       # parseWithRawJson -> ParsedPlan (7 days) + rawJson; AI_MALFORMED_JSON
│   └── plan-generator.parser.spec.ts / prompt.spec.ts / service.spec.ts
├── plan-modifier/
│   ├── plan-modifier.service.ts       # Lock userId; orchestrates MODIFICATION of an unconfirmed plan
│   ├── plan-modifier.prompt.ts        # buildModifyPlanPrompts(aiContext, names, currentPlan, comment)
│   ├── plan-modifier.prompt.spec.ts / service.spec.ts
├── plan-materializer/
│   └── plan-materializer.service.ts   # buildUniqueCatalogNames + resolveAgainstCatalog
│                                      #   + materializeWeekLog (exact/folded/subset/levenshtein layers)
└── plan-confirmation/
    ├── confirm-plan.service.ts        # confirm(userId, id, action) -> materializes + atomic confirmed mark
    └── entities/confirm-plan.output.entity.ts
```

**Idempotency locks (single-node):**
- `TrainingPlanService.generating` - key `userId::comment` -> deduplicates the plan **persistence**.
- `PlanGeneratorService.inFlight` - key `userId` -> deduplicates the **AI call** (same comment returns the same result; a different comment throws `ConflictException`).

## Name resolution: IA to catalog (`plan-materializer`)

The AI returns **names**; the materializer resolves them against the real catalog in **layers** (fuzzy matching):

| Layer | Strategy | Example |
|---|---|---|
| **L1 `exact`** | Equality after `normalizeString()` (lowercase, no accents). | `Press banca plano` -> catalog. |
| **L2 `folded`** | Equality ignoring singular/plural (`foldTokens`). | `Elevaciones laterales` -> `elevación lateral`. |
| **L3 `subset`** | All candidate tokens are within the AI name; the most specific wins; tie -> ambiguous (does not resolve). | `Press banca plano mancuernas` -> `press banca plano`. |
| **L4 `levenshtein`** | Bounded distance (<=2 for short, <=3 for long), **blocked when opposite words exist** (barra/mancuerna, abd/add...). | AI typo. |

Resolution rules:

- **Unresolvable** names are **dropped** with a warning (an AI invention does not sink the plan); if **no** exercise resolved, `400` with `AI_UNKNOWN_EXERCISE_NAME` and suggestions ("did you mean...?").
- If a day ends up with no exercises after dropping, it becomes `isRest = true`.
- Fuzzy matches are logged (`[materializeWeekLog] Resolución difusa`) because they suggest an AI typo or a catalog inconsistency.
- Catalog collisions (equivalent names after normalize) are ignored with a warning: they are data to fix.

## API GraphQL

```
TrainingPlan:
  generatePlan(comment: String) -> TrainingPlan          # generates AI draft (draft, confirmed:false)
  modifyPlan(id: String!, comment: String!) -> TrainingPlan # modifies an unconfirmed plan (version+1)
  confirmPlan(id: String!, action: PlanConfirmationAction) -> ConfirmPlanOutput
  trainingPlans(limit: Int, offset: Int) -> TrainingPlanPage
  trainingPlan(id: String!) -> TrainingPlan
  updateTrainingPlan(updateTrainingPlanInput) -> TrainingPlan
  removeTrainingPlan(id: String!) -> TrainingPlan        # only deletion route
```

**`PlanFocus`**: `fat_loss | muscle_gain | strength | endurance | maintenance | recomp`
**`PlanConfirmationAction`**: `create_week_log | create_routine_plan | adapt_active_week`

All operations protected with `GqlAuthGuard`.

### Enums and lifecycle

- `PlanStatus`: `draft -> active -> completed | abandoned | archived`.
- `PlanConfirmationAction`: `create_week_log | create_routine_plan | adapt_active_week` (reserved).
- `resolveFocus()` accepts the AI value if valid; otherwise derives from `goal.primary`; otherwise `maintenance`. Legacy values (`hypertrophy`, `sport_specific`, `general`) are normalized on read.

### Plan persistence

`TrainingPlanService.doGenerate()` persists `TrainingPlan` in `draft` state with:

- `userId`, `userProfileId`, `goalId`
- `title`, `focus` (enum `PlanFocus`), `status = draft`, `confirmed = false`
- `startDate = today`, `endDate = startDate + durationWeeks x 7`
- `durationWeeks`, `trainingDaysPerWeek`
- `aiSnapshot` (sent context, full prompt, model, raw response, tokens) - **required**

## Confirmation (`plan-confirmation/`)

`confirmPlan(id, action)` (mutation). Only accepts own, unconfirmed plans with an AI snapshot.

| Action | Effect | Restriction |
|---|---|---|
| `create_week_log` | Materializes the plan again from the snapshot (dates = today), inserts the `WorkoutSession`s and creates the active `WeekLog`. | Fails `409` if there is already an active week. |
| `create_routine_plan` | Creates `RoutinePlan` template (no weights) + `RoutineDay`s with the exercise categories (fallback `CORE`) and `isAiGenerated: true`, `generatedFromPlanId`. | Fails `400` if there are no training days. |
| `adapt_active_week` | **Reserved** - returns `501 Not Implemented`. | - |

Confirmation is **atomic**: `markConfirmed()` uses `findOneAndUpdate({ confirmed: false })` and returns `409` if the plan was already confirmed (closes the double-confirmation race). On confirm: `confirmed = true`, `status = active`, `confirmedAction`.

## Key details

- **The AI returns NAMES**, not IDs. `PlanMaterializerService` resolves against the real catalog (layers: exact -> folded singular/plural -> subset tokens -> levenshtein with opposite-word guard). Unresolvable names are **dropped** (generation continues); it only fails with 400 (`AI_UNKNOWN_EXERCISE_NAME`) if NO exercise of the plan resolved.
- **Entities are built in memory** in `generate`; they are persisted ONLY in `confirmPlan`.
- **`generatePlan` receives `comment`** (optional, added to the prompt as an additional user preference).
- **`modifyPlan(id, comment)`** modifies a plan **not yet confirmed** (`confirmed: false`). It resends the **current plan** + the user context + the comment to the AI, and **overwrites the SAME** `TrainingPlan` document (updates `aiSnapshot`, metadata, dates and increments `version`). It throws `ConflictException` if the plan was already confirmed. Reuses `buildPlanSystemPrompt()` to guarantee the same JSON output format. Implementation history in `documents/plans/modify-plan/plan.md`.
- **`CREATE_ROUTINE_PLAN`** creates `RoutineDay`s **only for training days** (drops `isRest` and days without exercises), not 7 days.
- **`ADAPT_ACTIVE_WEEK`** is reserved (501).
- In `CREATE_ROUTINE_PLAN`, the created `RoutinePlan` carries `isAiGenerated: true` and `generatedFromPlanId`.
- In `CREATE_WEEK_LOG`, a `ConflictException` is thrown if the user **already has an active week**.

## Env vars

Full reference and configuration of the cross-cutting `ai/` module in `documents/modules/ai.md`.

## Status and evolution

| Scenario | Status |
|---|---|
| 1 week per plan | Current |
| N weeks per plan | Future |
| `DayLog` as confirmation artifact | Future |
| New modules replicating the 8-stage scheme | Future |

> **Note:** AI plans are re-materialized against the catalog at confirmation. If an exercise was renamed/removed after generation, confirmation may drop it or fail (see `AI_UNKNOWN_EXERCISE_NAME`).

## Known limitations and technical debt

- **TrainingPlan is AI-only by design:** the manual route **was removed** (mutation `createTrainingPlan`, `service.create()` and `create-training-plan.input.ts`). `aiSnapshot` is `required: true` by design, since every plan comes from the AI. The manual week or routine is created directly with the WeekLog/RoutinePlan CRUD (the latter distinguishes origin with `isAiGenerated`). The `removePlan` alias was also removed; deletion is via `removeTrainingPlan`.
- **`comment` with no length limit:** `generatePlan(comment)` has no `@Max`. A very long (or malicious) comment can distort the prompt without server-side control.
- **`ADAPT_ACTIVE_WEEK`** not implemented (reserved).
- **AI week not persisted at generation:** `generatePlan` uses the WeekLog only for `startDate`; the real WeekLog is created at confirmation with `startDate = today`.
- **Goal created before the AI:** each generation creates a `Goal` before calling the AI; on failure or rate limit an orphan goal snapshot remains (no token cost, it is only auditing).
- **In-memory locks** (single-node): if scaled to multiple instances, migrate to Mongo locks with TTL.