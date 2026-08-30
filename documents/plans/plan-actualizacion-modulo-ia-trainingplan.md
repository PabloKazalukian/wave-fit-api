# Plan: Actualización Módulo IA-TrainingPlan — documentación canónica + limpieza de mutations heredadas

> Fecha: 2026-08-29
> Estado: Plan aprobado, pendiente de implementación

---

## Contexto

`src/modules/ai` y `src/modules/training-plan` están **completamente funcionales** (generación con IA, rate limit, retry/backoff, idempotencia, confirmación), pero su documentación quedó rezagada con respecto al código:

| Documento | Problema |
|---|---|
| `src/modules/training-plan/README.md` | Errores conceptuales: dice que la IA responde "IDs reales" (devuelve nombres), dice que el WeekLog "se persiste como parte del TrainingPlan" (se materializa en confirmPlan), omite `PlanMaterializerService` y los locks, no documenta `comment`, ni la naturaleza **solo-IA** del módulo |
| `src/modules/ai/README.md` | Es un diagnóstico de **junio 2026** previo a la implementación: marca `plan-generator.prompt.ts` y `parser.ts` como vacíos, modelo `llama-3.3-70b-versatile`, `generatePlan` "parcial". No menciona rate limit ni retry ni taxonomía `AI_CAUSE` |
| `documents/analysis/review-ai-plan-generation.md` | Review (2026-08-21) con 6 fallos, **todos hoy resueltos** (idempotencia, validación output, logging, rate limit, retry), marcados como "❌ No implementado" |
| `documents/config/ai.md` | Creado hoy (2026-08-29), refleja estado real, pero lista la mutation `createTrainingPlan` (a eliminar) |

Además quedaron **mutations heredadas** en `TrainingPlanResolver` que no se usan:

- `createTrainingPlan` — la ruta manual está **rota** (el schema `TrainingPlan` exige `aiSnapshot`, `userProfileId`, `goalId` y el service `create()` no los setea). El `TrainingPlan` es **solo-IA**: la semana/rutina manual se crea directamente con WeekLog/RoutinePlan, jamás con un TrainingPlan.
- `removePlan` — **duplicada** de `removeTrainingPlan`. El frontend usa `removeTrainingPlan`:

```graphql
mutation RemoveTrainingPlan($id: String!) {
    removeTrainingPlan(id: $id) {
        id
    }
}
```

---

## Decisiones confirmadas por el usuario

| Pregunta | Decisión |
|---|---|
| README de `src/modules/ai/` (obsoleto) | **Reescribirlo** como doc de la **capa transversal** (providers, rate limit, retry, auditoría, cómo consumir `AiService`) |
| `createTrainingPlan` (manual, roto) | **Eliminarla del código** (mutation + `service.create()` + DTO + spec + dependencia del update-input) |
| `documents/analysis/review-ai-plan-generation.md` | **Actualizar marcando lo resuelto** por punto (queda como histórico trazable) |
| `removePlan` (alias sin uso) | **Eliminarla**: el frontend usa `removeTrainingPlan` |
| Validación final | **Correr tests** (jest training-plan + ai), build y lint |

---

## Fase A — Limpieza de código: eliminar `createTrainingPlan`

### A.1 `src/modules/training-plan/training-plan.resolver.ts`

- Quitar el bloque `createTrainingPlan` (mutation, ~líneas 24-32).
- Quitar el import `CreateTrainingPlanInput` (línea 11).

### A.2 `src/modules/training-plan/training-plan.service.ts`

- Quitar el método `create()` (líneas 32-50).
- Quitar el import `CreateTrainingPlanInput` (línea 4).

### A.3 `src/modules/training-plan/training-plan.service.spec.ts`

- Quitar `describe('create', ...)` (líneas 68-111) y sus casos (defaults de fechas/tags, `startDate` provista).
- Mantener los demás bloques (`findAll`, `findOne`, `update`, `remove`, `generate`).

### A.4 `src/modules/training-plan/training-plan.resolver.spec.ts`

- Quitar `create: jest.fn()` del mock `trainingPlanServiceMock` (línea 15). `remove` se mantiene (lo usa `removeTrainingPlan`).

### A.5 `src/modules/training-plan/dto/create-training-plan.input.ts`

- **Eliminar archivo.**

### A.6 `src/modules/training-plan/dto/update-training-plan.input.ts`

- Hoy depende del archivo eliminado: `UpdateTrainingPlanInput extends PartialType(CreateTrainingPlanInput)`.
- Reescribir **autocontenido**: definir un base local con los mismos campos (`title`, `description`, `focus`, `durationWeeks`, `trainingDaysPerWeek`, `startDate`, `tags`) y `export class UpdateTrainingPlanInput extends PartialType(BaseInput)`. Sin importar el create-input.

> Verificado: no hay referencias en `test/` ni en otros módulos.

---

## Fase B — Limpieza de código: eliminar `removePlan`

### B.1 `src/modules/training-plan/training-plan.resolver.ts`

- Quitar la mutation `removePlan` (líneas 102-109).
- Se conserva `removeTrainingPlan` (única vía de borrado).

> Verificado: `removePlan` no tiene coverage en specs (ninguna spec la referencia).
> Confirmado por el usuario: el frontend usa `removeTrainingPlan`.

---

## Fase C — Validación con tests

Ejecutar y exigir **suite verde**:

```bash
npx jest --config jest.config.js src/modules/training-plan src/modules/ai
npm run build
npm run lint
```

- Los specs de `training-plan.service` y `training-plan.resolver` deben pasar tras la limpieza.
- Confirmar que no quedan imports rotos tras eliminar `create-training-plan.input.ts`.
- Comprobar que el build del schema GraphQL autogenerado ya no expone `createTrainingPlan` ni `removePlan`.

---

## Fase D — Documentación del módulo IA-TrainingPlan (canónica y reutilizable)

### D.1 Reescribir `src/modules/training-plan/README.md`

Convertirlo en la **referencia canónica del módulo y del patrón "módulo de generación con IA"** (reutilizable para futuros módulos: multi-semana, DayLog, etc.):

1. **Propósito** — TrainingPlan es **solo-IA**: genera un plan con IA y en `confirmPlan` materializa un **WeekLog** (1 semana) o un **RoutinePlan** template. No hay ruta manual (la semana/rutina manual se crea por WeekLog/RoutinePlan CRUD). Tampoco existe `createTrainingPlan` ni `removePlan` (eliminados).
2. **Pipeline real**:
   `generatePlan(comment)` → `TrainingPlanService.generate` (lock `userId+comment`) → `PlanGeneratorService.generatePlan` (lock `userId`) → `PlanValidatorService.validate` → snapshot `Goal` → catálogo de **nombres únicos** → `buildPlanPrompts` → `AiService.executePrompt` (rate limit + retry) → `PlanGeneratorParser` (JSON 7 días) → `PlanMaterializerService` (nombres → ids reales, capas exact/folded/subset/levenshtein; descarte de irresolubles) → persiste `TrainingPlan` `draft` + `aiSnapshot` → `confirmPlan(id, action)` materializa y marca `confirmed:true` atómico.
3. **Patrón reutilizable "módulo de generación con IA"** — 8 etapas genéricas (validar → snapshot entrada → prompt → LLM call → parsear → resolver/materializar → persistir borrador → confirmar) con el **contrato `aiSnapshot`** como fuente de verdad para confirmar, la taxonomía `AI_CAUSE` y los puntos en que un módulo nuevo debería replicar (validator, prompt builder, parser, materializer, locks, confirmación atómica).
4. **Corrección de errores actuales del README**: la IA devuelve **nombres** (no IDs); las entidades se construyen **en memoria** (no se persisten en generación); `generatePlan` recibe `comment`; `CREATE_ROUTINE_PLAN` crea RoutineDays **solo para días de entrenamiento** (no "7"); `ADAPT_ACTIVE_WEEK` reservado (501); IA-driven `isAiGenerated` en RoutinePlan.
5. **Arquitectura por archivo** real (incluye `PlanMaterializerService`, `PlanValidatorService`, `ConfirmPlanService`, `PlanGeneratorParser`, locks).
6. **API GraphQL** real: `generatePlan`, `confirmPlan`, `trainingPlans`, `trainingPlan`, `updateTrainingPlan`, `removeTrainingPlan`.
7. **Estado y evolución**: hoy **1 semana** por plan; a futuro **N semanas/plan**, **DayLog** como artefacto de confirmación, y nuevos módulos replicando el esquema.
8. Env vars y referencia a `documents/config/ai.md`.

### D.2 Reescribir `src/modules/ai/README.md`

Doc de la **capa transversal**:
1. Rol: `AiService.executePrompt()` = único punto de llamada al LLM; registry `'AI_PROVIDERS'` (patrón estrategia `IAiProvider`).
2. `GroqProvider`: `openai/gpt-oss-120b`, `temperature: 0`, `reasoningEffort: 'low'`, `maxRetries: 0`, `timeout`/`maxTokens` desde env.
3. **Rate limit**: `AiUsage` (ventana UTC, índice único + TTL 2 días), `AiRateLimitService`, upsert atómico, E11000 retry, `aiUsageStatus`.
4. **Reintentos**: transitoriedad (timeout/network/5xx/429/EMPTY_RESPONSE), backoff con `Retry-After`, presupuesto global, `AI_*` env vars.
5. Taxonomía `AI_CAUSE` + auditoría (`AI_PROMPT_EXECUTED`).
6. **Cómo consumir `AiService` desde un módulo nuevo** (paso a paso).

### D.3 Actualizar `documents/config/ai.md`

- Sección 6 (API GraphQL): quitar la línea `createTrainingPlan(...)` y `removePlan(id)`.
- Sección 8 (Limitaciones): reescribir el punto "Flag origen AI vs MANUAL" → la ruta manual fue **eliminada**; el módulo es solo-IA y `aiSnapshot` requerido es por diseño. Añadir nota de que `removePlan` (alias) fue eliminado.

### D.4 Actualizar `AGENTS.md`

- Sección 9 (Rutas GraphQL): `TrainingPlan:` → quitar `createTrainingPlan,` y `, removePlan`.
- Sección 16: mantener, queda alineada (ya no menciona manual).

### D.5 Actualizar `documents/analysis/review-ai-plan-generation.md`

Marcar el estado real de los 6 puntos del resumen ejecutivo (sin borrar el análisis):

| # | Punto | Estado real 2026-08-29 |
|---|---|---|
| 1 | Idempotencia | ✅ Resuelto: `generating` (userId+comment) + `inFlight` (userId) |
| 2 | Validación en modificación | ⚠️ Parcial: materializer descarta/valida nombres contra catálogo; sigue pendiente `@Max` en `comment` |
| 3 | Logging de causa | ✅ Resuelto: Loggers + audit + raw contenido truncado (500 chars) |
| 4 | Rate limit por usuario | ✅ Resuelto: `AiUsage` + `AiRateLimitService` |
| 5 | Flag AI vs MANUAL | ✅ Resuelto por diseño: ruta manual eliminada; TrainingPlan solo-IA (RoutinePlan mantiene `isAiGenerated`) |
| 6 | Retry/backoff/timeout | ✅ Resuelto: loop externo con presupuesto + `maxRetries:0` en SDK |

Añadir banner de fecha y puntero a `documents/config/ai.md` y al README de training-plan como fuente vigente.

---

## Archivos afectados (resumen)

| Archivo | Acción |
|---|---|
| `src/modules/training-plan/training-plan.resolver.ts` | Editar (quitar `createTrainingPlan` y `removePlan`) |
| `src/modules/training-plan/training-plan.service.ts` | Editar (quitar `create()`) |
| `src/modules/training-plan/training-plan.service.spec.ts` | Editar (quitar bloque `create`) |
| `src/modules/training-plan/training-plan.resolver.spec.ts` | Editar (quitar mock `create`) |
| `src/modules/training-plan/dto/create-training-plan.input.ts` | **Eliminar** |
| `src/modules/training-plan/dto/update-training-plan.input.ts` | Reescribir autocontenido |
| `src/modules/training-plan/README.md` | **Reescribir** (canónico + patrón reusable) |
| `src/modules/ai/README.md` | **Reescribir** (capa transversal) |
| `documents/config/ai.md` | Editar (rutas + limitaciones) |
| `AGENTS.md` | Editar (sección 9) |
| `documents/analysis/review-ai-plan-generation.md` | Editar (estados resueltos + banner) |

---

## Orden de ejecución

A (quitar `createTrainingPlan`) → B (quitar `removePlan`) → C (tests/build/lint verdes) → D (documentación con el estado final del código).

> **Fuera de alcance:** `updateTrainingPlan` y `removeTrainingPlan` se conservan. No se toca el flujo de generación/confirmación (ya correcto).