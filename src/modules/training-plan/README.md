# Training Plan Module — Generación de planes con IA

> ⚠️ **Módulo SOLO-IA.** Un `TrainingPlan` se crea exclusivamente vía `generatePlan` (IA). **No existe** ruta manual de creación: la semana de tracking o la rutina manual se crean directamente con los CRUD de WeekLog/RoutinePlan, jamás con un TrainingPlan. La mutation `createTrainingPlan` y el alias `removePlan` fueron **eliminados** (usa `removeTrainingPlan`).

## Propósito

`generatePlan(comment)` construye un plan de entrenamiento personalizado con IA. En `confirmPlan(id, action)` se **materializa** el resultado en un artefacto real:

- `confirmPlan(..., CREATE_WEEK_LOG)` → crea un `WeekLog` (1 semana) + sus `WorkoutSession`s.
- `confirmPlan(..., CREATE_ROUTINE_PLAN)` → crea un `RoutinePlan` template (sin pesos) con `RoutineDay`s solo para días de entrenamiento.
- `confirmPlan(..., ADAPT_ACTIVE_WEEK)` → **reservado** (501, aún no implementado).

La IA **no devuelve IDs**, devuelve **nombres de ejercicios**. Nada se persiste en `generatePlan` salvo el propio `TrainingPlan` (borrador `draft`); el WeekLog y las sesiones se construyen **en memoria** y solo se materializan al confirmar.

---

## Pipeline real

```
generatePlan(comment)
  └─ TrainingPlanService.generate(userId, comment)     [lock userId+comment]
       └─ PlanGeneratorService.generatePlan(userId, comment)   [lock userId]
            ├─ PlanValidatorService.validate(userId)   → valida perfil completo
            ├─ UserProfileService.getFullProfileContext(userId) → 8 sub-docs
            ├─ buildUserContextForAI(profile)          → JSON para el prompt
            ├─ GoalModel.create({ contextSnapshot })   → snapshot del objetivo
            ├─ ExerciseService.findAll()                → catálogo completo
            ├─ PlanMaterializerService.buildUniqueCatalogNames(exercises)
            │        → nombres ÚNICOS (sin ids ni categorías) para el prompt
            ├─ buildPlanPrompts(aiContext, exerciseNames, comment)
            │        → systemPrompt + userPrompt (+ comment del usuario)
            ├─ AiService.executePrompt({ provider, system, user, userId })
            │        → rate limit + retry/backoff (ver README de ai/)
            ├─ PlanGeneratorParser.parseWithRawJson(rawContent)
            │        → ParsedPlan { title, focus, durationWeeks, daysPerWeek, days[7] }
            ├─ PlanMaterializerService.materializeWeekLog(userId, parsedPlan)
            │        → resuelve nombres → ids reales (capas exact/folded/subset/levenshtein)
            │        → construye WeekLogDomain + WorkoutSessions EN MEMORIA (startDate=hoy)
            └─ persiste TrainingPlan { status: draft, confirmed: false, aiSnapshot }
```

**`confirmPlan(id, action)`**:
1. Busca el plan por `_id` + `userId` (scope por usuario).
2. Rechaza doble confirmación **atómica** (`findOneAndUpdate({ confirmed: false })`).
3. Recupera el `ParsedPlan` desde `plan.aiSnapshot.rawResponse` (lo re-parsea y re-valida).
4. Re-materializa contra el **catálogo vigente** al momento de confirmar.
5. Ejecuta la acción: crea WeekLog o RoutinePlan (ver arriba).
6. Marca `confirmed: true`, `status: ACTIVE`, `confirmedAction` y el link del artefacto creado (`resultingWeekLogId` / `resultingRoutinePlanId`).
7. Audita `TRAINING_PLAN_CONFIRMED`.

---

## Patrón reutilizable: "módulo de generación con IA"

Esta es la plantilla que conviene replicar en futuros módulos de generación (plans multi-semana, DayLog, etc.):

| Etapa | Pieza | TrainingPlan actual |
|---|---|---|
| 1. Validar entrada | `PlanValidatorService` | Valida perfil + objetivo + horario (campos `missing` bloquean; `recommended` no) |
| 2. Snapshot de entrada | modelo `Goal` | `GoalModel.create({ contextSnapshot })` para auditoría |
| 3. Construir prompt | `buildPlanPrompts` | Contexto + catálogo de nombres únicos + `comment` |
| 4. Llamada a la IA | `AiService.executePrompt` | Único punto de llamada al LLM (rate limit + retry) |
| 5. Parsear | `PlanGeneratorParser` | JSON validado (7 días, estructura tipada), errores con `AI_MALFORMED_JSON` |
| 6. Resolver/Materializar | `PlanMaterializerService` | Nombres IA → ids reales; descarte de irresolubles; build de entidades en memoria |
| 7. Persistir borrador | `TrainingPlan` | `status: draft`, `confirmed: false`, con `aiSnapshot` |
| 8. Confirmar | `ConfirmPlanService` | Acción elegida; `findOneAndUpdate({ confirmed:false })` atómico |

**Contrato `aiSnapshot`** (fuente de verdad para confirmar). Guía lo que se envió/resolvió:
`contextSentToAI`, `promptUsed`, `modelUsed`, `rawResponse` (el JSON crudo), `tokensUsed`, `generatedAt`.

**Taxonomía de errores** (`AI_CAUSE`): `AI_PROVIDER_ERROR`, `AI_MALFORMED_JSON`, `AI_EMPTY_RESPONSE`, `AI_UNKNOWN_EXERCISE_NAME`, `RATE_LIMIT_EXCEEDED`.

Puntos que un módulo nuevo debería replicar: un validator, un prompt builder, un parser, un materializer, **locks de idempotencia** (en memoria por `userId` y por `userId+comment`) y **confirmación atómica**.

---

## Arquitectura por archivo

```
src/modules/training-plan/
├── training-plan.module.ts            # Wiring del módulo (exports ConfirmPlanService)
├── training-plan.resolver.ts          # Queries/Mutations GraphQL (guard JWT)
├── training-plan.service.ts           # Facade: generate (lock userId+comment) + findAll/findOne/update/remove
├── schema/
│   ├── training-plan.schema.ts        # TrainingPlan + enums (PlanStatus, PlanFocus, PlanConfirmationAction)
│   │                                  #   + normalizePlanFocus() (mapeo legacy)
│   └── ai-snapshot.schema.ts          # AiSnapshot embebido (contexto/prompt/modelo/raw/tokens)
├── entities/                          # Tipos GraphQL de salida (TrainingPlan, AiSnapshot, Goal...)
├── dto/
│   └── update-training-plan.input.ts  # Único input CRUD (autocontenido); sin create-training-plan.input
├── plan-validator/
│   └── plan-validator.service.ts      # Valida perfil completo; devuelve missing/recommended
├── plan-generator/
│   ├── plan-generator.service.ts      # Lock userId; orquesta validación→prompt→IA→parse→materialize
│   ├── plan-generator.prompt.ts       # buildPlanSystemPrompt() (reutilizable) + buildPlanPrompts(...)
│   ├── plan-generator.parser.ts       # parseWithRawJson → ParsedPlan (7 días) + rawJson; AI_MALFORMED_JSON
│   └── plan-generator.parser.spec.ts / prompt.spec.ts / service.spec.ts
├── plan-modifier/
│   ├── plan-modifier.service.ts       # Lock userId; orquesta la MODIFICACIÓN de un plan no confirmado
│   ├── plan-modifier.prompt.ts        # buildModifyPlanPrompts(aiContext, names, currentPlan, comment)
│   ├── plan-modifier.prompt.spec.ts / service.spec.ts
├── plan-materializer/
│   └── plan-materializer.service.ts   # buildUniqueCatalogNames + resolveAgainstCatalog
│                                      #   + materializeWeekLog (capas exact/folded/subset/levenshtein)
└── plan-confirmation/
    ├── confirm-plan.service.ts        # confirm(userId, id, action) → materializa + marca confirmed atómico
    └── entities/confirm-plan.output.entity.ts
```

**Locks de idempotencia (single-node):**
- `TrainingPlanService.generating` — key `userId::comment` → deduplica la **persistencia** del plan.
- `PlanGeneratorService.inFlight` — key `userId` → deduplica la **llamada a la IA** (mismo comment devuelve el mismo resultado; comment distinto lanza `ConflictException`).

---

## API GraphQL

```
TrainingPlan:
  generatePlan(comment: String) -> TrainingPlan          # genera borrador IA (draft, confirmed:false)
  modifyPlan(id: String!, comment: String!) -> TrainingPlan # modifica un plan no confirmado (version+1)
  confirmPlan(id: String!, action: PlanConfirmationAction) -> ConfirmPlanOutput
  trainingPlans(limit: Int, offset: Int) -> TrainingPlanPage
  trainingPlan(id: String!) -> TrainingPlan
  updateTrainingPlan(updateTrainingPlanInput) -> TrainingPlan
  removeTrainingPlan(id: String!) -> TrainingPlan        # única vía de borrado
```

**`PlanFocus`**: `fat_loss | muscle_gain | strength | endurance | maintenance | recomp`
**`PlanConfirmationAction`**: `create_week_log | create_routine_plan | adapt_active_week`

---

## Detalles clave (corrección de errores históricos del README)

- **La IA devuelve NOMBRES**, no IDs. `PlanMaterializerService` resuelve contra el catálogo real (capas: exact → folded singular/plural → subset tokens → levenshtein con guarda de opuestos). Los nombres irresolubles se **descartan** (la generación continúa); solo falla con 400 (`AI_UNKNOWN_EXERCISE_NAME`) si NINGÚN ejercicio del plan resolvió.
- **Las entidades se construyen en memoria** en `generate`; se persisten SOLO en `confirmPlan`.
- **`generatePlan` recibe `comment`** (opcional, se añade al prompt como preferencia adicional del usuario).
- **`modifyPlan(id, comment)`** modifica un plan **aún no confirmado** (`confirmed: false`). Reenvía a la IA el **plan actual** + el contexto del usuario + el comentario, y **sobrescribe el MISMO documento** `TrainingPlan` (actualiza `aiSnapshot`, metadatos, fechas e incrementa `version`). Lanza `ConflictException` si el plan ya fue confirmado. Reutiliza `buildPlanSystemPrompt()` para garantizar el mismo formato JSON de salida. Detalle del plan en `plans/ai/modifate/`.
- **`CREATE_ROUTINE_PLAN`** crea `RoutineDay`s **solo para días de entrenamiento** (descarta `isRest` y días sin ejercicios), no 7 días.
- **`ADAPT_ACTIVE_WEEK`** está reservado (501).
- En `CREATE_ROUTINE_PLAN`, el `RoutinePlan` creado lleva `isAiGenerated: true` y `generatedFromPlanId`.
- En `CREATE_WEEK_LOG`, se lanza `ConflictException` si el usuario **ya tiene una semana activa**.

---

## Env vars

Referencia completa y configuración del módulo transversal `ai/` en `documents/config/ai.md`.

---

## Estado y evolución

| Escenario | Estado |
|---|---|
| 1 semana por plan | ✅ Actual |
| N semanas por plan | 🔜 Futuro |
| `DayLog` como artefacto de confirmación | 🔜 Futuro |
| Nuevos módulos replicando el esquema 8-etapas | 🔜 Futuro |

> **Nota:** los planes IA se re-materializan contra el catálogo al confirmar. Si un ejercicio fue renombrado/eliminado después de generar, la confirmación puede descartarlo o fallar (ver `AI_UNKNOWN_EXERCISE_NAME`).
