# AI — Módulo de IA y Generación de Planes de Entrenamiento

> **Última actualización:** 2026-08-29
> **Estado:** Implementado y en producción (flujo `generatePlan` + `confirmPlan`)
> **Alcance:** `src/modules/ai`, `src/modules/training-plan`

## 1. Propósito

Se compone de dos módulos:

| Módulo | Responsabilidad |
|--------|-----------------|
| `src/modules/ai` | Capa transversal de IA: proveedores de LLM (Groq), **rate limit** diario por usuario, **reintentos con backoff y presupuesto** de tiempo, y **auditoría** de cada llamada. |
| `src/modules/training-plan` | Generación de **planes de entrenamiento personalizados** con IA, su validación, persistencia y **confirmación** (WeekLog o RoutinePlan). |

Flujo completo:

```
Frontend
  → generatePlan(comment)              [TrainingPlanResolver]
    → TrainingPlanService.generate()   — lock idempotente por userId+comment
      → PlanGeneratorService.generatePlan()
        → planValidator.validate()     — completitud del perfil
        → goalModel.create()           — snapshot del objetivo
        → materializer.buildUniqueCatalogNames()  — nombres únicos (ahorra tokens)
        → buildPlanPrompts()           — system + user prompt
        → aiService.executePrompt()    — rate limit + proveedor + reintentos
          → GroqProvider (ChatGroq)    — llama al LLM
        → parser.parseWithRawJson()    — valida estructura JSON (7 días)
        → materializer.materializeWeekLog() — resuelve ejercicios + arma WeekLog en memoria
      → trainingPlanModel.create()     — persiste TrainingPlan + aiSnapshot
  → confirmPlan(id, action)            [TrainingPlanResolver]
    → ConfirmPlanService.confirm()
      → create_week_log | create_routine_plan
```

---

## 2. Módulo `src/modules/ai`

### Archivos

| Archivo | Rol |
|---------|-----|
| `ai.module.ts` | Registra `AiUsageSchema`, proveedores (Groq) y exporta `AiService`, `AiRateLimitService`, token `'AI_PROVIDERS'`. |
| `ai.service.ts` | `executePrompt()`: rate limit → selección de proveedor → loop de reintentos con presupuesto global → audit + log. |
| `ai-rate-limit.service.ts` | Rate limit **fixed window** diario (ventana UTC) sobre Mongo. |
| `providers/groq.provider.ts` | Instancia `ChatGroq` de LangChain con configuración explícita (timeout, maxTokens, `maxRetries: 0`). |
| `interfaces/ai-proider.interface.ts` | `IAiProvider` (`name` + `getModel()`). Contrato para agregar proveedores. |
| `schemas/ai-usage.schema.ts` | Colección `ai_usage` (contador por usuario/ventana). |
| `ai-error-causes.ts` | Taxonomía `AI_CAUSE` para logs y auditoría. |
| `dto/ai-usage-status.output.ts` | Output GraphQL del uso diario. |

### `executePrompt()` — comportamiento

```
executePrompt({ providerName, systemPrompt, userPrompt, userId })
  0. Rate limit (solo si userId)  → assertWithinLimit(userId)
  1. Resolver proveedor del registry 'AI_PROVIDERS'
  2. Armar mensajes LangChain [SystemMessage, HumanMessage]
  3. Loop de reintentos (máx. AI_MAX_ATTEMPTS, default 3):
     - Si Date.now() >= budgetDeadline → abandonar sin intentar
     - model.invoke(messages)
       → respuesta vacía (EMPTY_RESPONSE) ⇒ error reintentable
     - error ⇒ clasificar causa + transient
       → si no es transitorio o es el último intento ⇒ break
       → backoff (respetando Retry-After en 429) si entra en el presupuesto
  4. Éxito ⇒ log + audit (AI_PROMPT_EXECUTED, tokens, duración)
     Fracaso ⇒ log + audit con causa y re-lanzar el error original
```

Se ejecuta exactamente **una** llamada a Groq por `executePrompt` salvo reintentos de errores transitorios; el resultado de la IA nunca se cachea entre llamadas del usuario.

### Rate limit por usuario

- **Ventana:** día UTC (inicio de medianoche UTC). Se reinicia sola cada día.
- **Contador:** colección `ai_usage` (schema `AiUsage`), un doc por `userId + windowStart`.
  - Índice único `{ userId: 1, windowStart: 1 }` → el upsert con `$inc` es atómico.
  - Índice TTL `{ windowStart: 1 }` `expireAfterSeconds: 2 días` → purga ventanas viejas.
  - Carrera del primer insert (E11000) → se reintenta una vez.
- **Límite:** `AI_DAILY_LIMIT` (default **10**). Al superarlo responde `429 TOO_MANY_REQUESTS` con `code: RATE_LIMIT_EXCEEDED`, `limit` y `resetAt`.
- **Punto de corte:** al inicio de `executePrompt`, por lo que cubre a **todo consumidor** del módulo AI.
- **Consulta sin modificar contador:** `aiUsageStatus` (resolver `aiUsageStatus`) → `{ used, limit, remaining, resetAt }`.

### Reintentos, timeout y backoff

| Parámetro | Env | Default | Descripción |
|-----------|-----|---------|-------------|
| Timeout por intento | `AI_CALL_TIMEOUT_MS` | 45000 ms | `timeout` del cliente `ChatGroq`. |
| Intentos totales | `AI_MAX_ATTEMPTS` | 3 | 1 intento + 2 reintentos máximo. |
| Presupuesto global | `AI_TOTAL_BUDGET_MS` | 80000 ms | Tope compartido entre intentos+backoff. |
| Backoff base | — | `min(1000ms × intento, 4000ms)` | Retroceso corto fijo con cap. En **429** se respeta `Retry-After` (o el mensaje "try again in Xs" de Groq). |

Reglas de reintento:

- Solo se reintentan errores **transitorios**: timeout, errores de red (`ETIMEDOUT`, `ECONNREFUSED`, `ENOTFOUND`, `fetch failed`…), HTTP 5xx, 429 y **respuesta vacía**.
- No se reintentan: errores HTTP 4xx (no-429) ni errores desconocidos.
- Si el backoff no entra en el presupuesto restante, se abandona sin nuevo intento.
- El `ChatGroq` se configura con `maxRetries: 0`: la **única** capa de reintento vive en `AiService` (sin anidamiento).

### Respuesta vacía (EMPTY_RESPONSE)

Problema real: los modelos de razonamiento pueden **agotar el presupuesto de salida durante el razonamiento** y devolver `content` vacío sin lanzar error. Se detecta en `finalizeSuccess()`, se clasifica como `AI_EMPTY_RESPONSE` (transitorio) y se reintenta.

### Taxonomía de errores (`AI_CAUSE`)

| Causa | Valor | Uso |
|-------|-------|-----|
| `PROVIDER` | `AI_PROVIDER_ERROR` | Timeout, red, 5xx o fallo desconocido del proveedor. |
| `MALFORMED_JSON` | `AI_MALFORMED_JSON` | La IA devolvió JSON inválido (el parser loguea el contenido crudo truncado a 500 chars). |
| `EMPTY_RESPONSE` | `AI_EMPTY_RESPONSE` | Respuesta "exitosa" pero sin contenido. |
| `UNKNOWN_EXERCISE_NAME` | `AI_UNKNOWN_EXERCISE_NAME` | La IA devolvió ejercicios fuera del catálogo y ninguno resolvió. |
| `RATE_LIMIT` | `RATE_LIMIT_EXCEEDED` | Límite diario de generaciones alcanzado (429). |

### Auditoría

Cada llamada a `executePrompt` registra en `AuditLogs` (acción `AI_PROMPT_EXECUTED`, éxito o fallo) con: `provider`, `modelUsed`, `durationMs`, `tokensUsed` y en fallos `cause`, `transient`, `httpStatus`, `attempts`. El mismo patrón se replica en `PlanGeneratorService` (acción `TRAINING_PLAN_GENERATED`) y `ConfirmPlanService` (acción `TRAINING_PLAN_CONFIRMED`).

---

## 3. Generación de Planes (`src/modules/training-plan`)

### Pipeline de generación (`plan-generator/`)

1. **`plan-validator.service.ts`** — Valida **completitud del perfil** antes de gastar cuota de IA:
   - **Bloqueantes:** `UserProfile` (birthDate, heightCm, weightKg), `UserGoal` (primaryGoal, trainingExperience), `UserSchedule` (daysPerWeek o preferredDays).
   - **Recomendados (no bloquean):** `UserResource` (equipamiento/entorno), `UserTrainingPreference` (estilos), `UserStrengthMetric` (1RM).
   - Responde `400` con `{ message, missing[], recommended[] }`.
2. **`goalModel.create()`** — Guarda un snapshot del contexto del objetivo (`Goal`) **antes** de llamar a la IA.
3. **Catálogo de ejercicios** — Se envía a la IA **solo los nombres únicos** (sin ids ni categorías) para ahorrar tokens; los `exerciseId` se resuelven contra la DB después (`materializer.buildUniqueCatalogNames()`).
4. **`plan-generator.prompt.ts`** — `buildPlanPrompts(aiContext, exerciseNames, comment)`:
   - System prompt: reglas del preparador físico (alineación con objetivo, restricciones de salud, distribución de descansos, estructura JSON de 7 días).
   - User prompt: contexto del usuario (compacto, sin indentar), instrucciones, consideraciones dinámicas (lesiones, restricciones de movimiento, dislikes/favoritos, intensidad, cardio, equipamiento, entornos, 1RM) y catálogo.
   - El `comment` del usuario se agrega al final como "preferencia adicional" si no está vacío.
5. **`plan-generator.parser.ts`** — `parseWithRawJson()`:
   - Extrae el JSON (limpia ```json / ```).
   - Valida estructura estricta: `days` de **exactamente 7** entradas, `order` numérico, `isRest` booleano, `name` no vacío en ejercicios.
   - En JSON inválido loguea el contenido crudo (500 chars) y responde `400` (`AI_MALFORMED_JSON`).
   - Normaliza tipos (`durationWeeks >= 1`, defaults).
6. **`plan-materializer.service.ts`** — `materializeWeekLog()`:
   - Resuelve cada nombre de la IA contra el catálogo real (ver §4).
   - Construye `WeekLogDomain` + `WorkoutSessionCreationData[]` **en memoria** con fechas UTC derivadas del `LocalDate` del usuario (timezone `America/Argentina/Buenos_Aires`).
   - Este output **no se persiste** en la generación; es la base para la confirmación.

### Idempotencia (locks en memoria)

Dos capas para deduplicar requests concurrentes (válido para deploy **single-node**):

| Capa | Lock | Clave |
|------|------|-------|
| `TrainingPlanService.generating` | Evita duplicar el `TrainingPlan` persistido | `userId + '::' + comment` |
| `PlanGeneratorService.inFlight` | Deduplica la **llamada a la IA** | `userId` (si otra con distinto comment → `409 Conflict`) |

Si crecen a múltiples instancias, migrar a un lock Mongo con TTL siguiendo el mismo punto de corte.

### Persistencia del plan

`TrainingPlanService.doGenerate()` persiste `TrainingPlan` en estado `draft` con:

- `userId`, `userProfileId`, `goalId`
- `title`, `focus` (enum `PlanFocus`), `status = draft`, `confirmed = false`
- `startDate = hoy`, `endDate = startDate + durationWeeks × 7`
- `durationWeeks`, `trainingDaysPerWeek`
- `aiSnapshot` (contexto enviado, prompt completo, modelo, respuesta cruda, tokens) — **requerido**

### PlanFocus

`fat_loss | muscle_gain | strength | endurance | maintenance | recomp`. `resolveFocus()` acepta el valor de la IA si es válido, sino deriva de `goal.primary`, sino `maintenance`. Valores legacy (`hypertrophy`, `sport_specific`, `general`) se normalizan al leer.

### Enums del ciclo de vida

- `PlanStatus`: `draft → active → completed | abandoned | archived`.
- `PlanConfirmationAction`: `create_week_log | create_routine_plan | adapt_active_week` (reservado).

---

## 4. Resolución de Ejercicios IA → Catálogo (`plan-materializer`)

La IA devuelve **nombres**; el materializer los resuelve contra el catálogo real en **capas** (matching difuso):

| Capa | Estrategia | Ejemplo |
|------|-----------|---------|
| **L1 `exact`** | Igualdad tras `normalizeString()` (minúsculas, sin acentos). | `Press banca plano` → catálogo. |
| **L2 `folded`** | Igualdad ignorando singular/plural (`foldTokens`). | `Elevaciones laterales` → `elevación lateral`. |
| **L3 `subset`** | Todos los tokens del candidato están en el nombre IA; gana el más específico; empate ⇒ ambigüo (no resuelve). | `Press banca plano mancuernas` → `press banca plano`. |
| **L4 `levenshtein`** | Distancia acotada (≤2 para cortos, ≤3 para largos), **bloqueada si hay palabras opuestas** (barra/mancuerna, abd/add…). | Typo de la IA. |

Reglas de resolución:

- Nombres **irresolubles** se **descartan** con advertencia (un invento de la IA no tira el plan); si **ningún** ejercicio resolvió, `400` con `AI_UNKNOWN_EXERCISE_NAME` y sugerencias ("¿quiso decir…?").
- Si un día queda sin ejercicios tras el descarte, pasa a `isRest = true`.
- Los matches difusos se loguean (`[materializeWeekLog] Resolución difusa`) porque sugieren typo de la IA o inconsistencia del catálogo.
- Colisiones del catálogo (nombres equivalentes tras normalizar) se ignoran con warning: son datos a corregir.

---

## 5. Confirmación del Plan (`plan-confirmation/`)

`confirmPlan(id, action)` (mutation). Solo admite planes propios, no confirmados, con snapshot de IA.

| Acción | Efecto | Restricción |
|--------|--------|-------------|
| `create_week_log` | Materializa de nuevo el plan desde el snapshot (fechas = hoy), inserta las `WorkoutSession` y crea el `WeekLog` activo. | Falla `409` si ya hay una semana activa. |
| `create_routine_plan` | Crea `RoutinePlan` template (sin pesos) + `RoutineDay`s con las categorías de los ejercicios (fallback `CORE`) y `isAiGenerated: true`, `generatedFromPlanId`. | Falla `400` si no hay días de entrenamiento. |
| `adapt_active_week` | **Reservado** — devuelve `501 Not Implemented`. | — |

La confirmación es **atómica**: `markConfirmed()` usa `findOneAndUpdate({ confirmed: false })` y devuelve `409` si el plan ya fue confirmado (cierra la carrera de doble confirmación). Al confirmar: `confirmed = true`, `status = active`, `confirmedAction`.

---

## 6. API GraphQL

```
AI:
  aiUsageStatus -> AiUsageStatusOutput { used, limit, remaining, resetAt }

TrainingPlan:
  createTrainingPlan(createTrainingPlanInput) -> TrainingPlan        # manual
  trainingPlans(limit, offset) -> TrainingPlanPage                    # paginado
  trainingPlan(id) -> TrainingPlan
  updateTrainingPlan(updateTrainingPlanInput) -> TrainingPlan
  removeTrainingPlan(id) -> TrainingPlan
  generatePlan(comment = '') -> TrainingPlan                          # con IA
  confirmPlan(id, action: PlanConfirmationAction) -> ConfirmPlanOutput
  removePlan(id) -> TrainingPlan

Enums GraphQL:
  PlanStatus: draft | active | completed | abandoned | archived
  PlanFocus: fat_loss | muscle_gain | strength | endurance | maintenance | recomp
  PlanConfirmationAction: create_week_log | create_routine_plan | adapt_active_week
```

Todos protegidos con `GqlAuthGuard`.

---

## 7. Variables de Entorno del Módulo AI

```bash
GROQ_API_KEY=              # API key de Groq (ChatGroq)
PREFERRED_AI_PROVIDER=groq # Proveedor default del plan-generator ('groq')
AI_DAILY_LIMIT=10          # Máx. llamadas IA por usuario/día UTC
AI_CALL_TIMEOUT_MS=45000   # Timeout por intento en ChatGroq
AI_MAX_ATTEMPTS=3          # Intentos totales (1 + 2 reintentos transitorios)
AI_TOTAL_BUDGET_MS=80000   # Presupuesto global compartido entre reintentos
AI_MAX_OUTPUT_TOKENS=5000  # Presupuesto de tokens de salida (combate content vacío)
```

Modelo actual del proveedor Groq: `openai/gpt-oss-120b`, `temperature: 0`, `reasoningEffort: 'low'`, `maxRetries: 0`.

---

## 8. Limitaciones y Deuda Técnica Conocida

- **Flag origen AI vs MANUAL:** `TrainingPlan` **no** tiene campo `source`. `aiSnapshot` es `required: true` y la ruta manual `createTrainingPlan` **no lo setea**, por lo que hoy la creación manual fallaría en la validación de Mongoose (el schema asume planes de IA). `RoutinePlan` sí distingue con `isAiGenerated`.
- **`comment` sin límite de longitud:** `generatePlan(comment)` no tiene `@Max`. Un comentario muy largo (o malicioso) puede distorsionar el prompt sin control server-side.
- **`ADAPT_ACTIVE_WEEK`** no implementado (reservado).
- **Semana de la IA no persistida en generación:** `generatePlan` usa el `WeekLog` solo para `startDate`; el WeekLog real se crea en la confirmación con `startDate = hoy`.
- **Goal creado antes de la IA:** cada generación crea un `Goal` antes de llamar a la IA; ante fallo o rate limit queda un snapshot de objetivo huérfano (sin costo de tokens, es solo auditoría).
- **Locks en memoria** (single-node): si se escala a múltiples instancias, migrar a locks Mongo con TTL.
- **`console.log`/`console.error` sueltos:** `plan-generator.parser.ts:51` y otros puntos en tracking — candidatos a migrar a `Logger`.

---

## 9. Tests

- Unitarios: `src/modules/ai/*.spec.ts` (service, rate-limit, resolver) y `src/modules/training-plan/**/*.spec.ts` (service, resolver, generator, parser, prompt, validator, materializer, confirmation).
- Verificación rápida: `npx jest --config jest.config.js src/modules/ai src/modules/training-plan`