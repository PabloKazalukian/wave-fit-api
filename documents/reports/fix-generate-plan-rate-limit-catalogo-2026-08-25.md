# Fix generatePlan: rate limit 429, ejercicios desconocidos y duplicados del catálogo

> **Fecha:** 2026-08-25
> **Módulos:** `ai`, `training-plan`, `routines/templates/exercise`, `database`

---

## Contexto

Durante el flujo `generatePlan` (plan de entrenamiento con IA) se detectaron 3 problemas en logs:

1. **429 RATE_LIMIT_EXCEEDED** de Groq con reintentos que no esperaban lo que el proveedor pedía.
2. **Warnings** de `PlanMaterializerService` por nombres duplicados en el catálogo (`"Remo con Mancuerna"` x2, `"Sentadilla"/"Sentadillas"`, etc.).
3. **`AI_UNKNOWN_EXERCISE_NAME`**: la IA devolvió un nombre fuera del catálogo ("Pull-up") y **toda la generación fallaba con 400** por culpa de 1 ejercicio.

## Decisiones tomadas

| Problema | Decisión |
|----------|----------|
| Ejercicio desconocido | **Descartar y continuar**: eliminar los desconocidos con WARN; solo fallar si NINGÚN ejercicio resuelve |
| Rate limit 429 | **Solo fix retry-after**: parsear hint del message + leer `error.headers` de groq-sdk (sin throttle ni reducción de prompt) |
| Duplicados del catálogo | **Migración completa**: merge con repointeo de referencias + seed dedup + índice único |

---

## Fix 1 — Retry-after real de Groq en 429

**Archivos:** `src/modules/ai/ai.service.ts`, `src/modules/ai/ai.service.spec.ts`

### Causa raíz
- `extractRetryAfterMs()` solo leía `error.response.headers['retry-after']`, pero:
  - El error de groq-sdk expone headers en `error.headers` (raíz), no en `.response.headers`.
  - Groq muchas veces **no manda header**: el hint viene solo en el message (`"Please try again in 3.8775s"`).
- Al no encontrar nada, caía al backoff genérico (1s/2s) → reintentaba antes de tiempo y quemaba más del presupuesto TPM.

### Solución
`extractRetryAfterMs()` ahora, en orden de prioridad:
1. Header `retry-after` en `error.response.headers` **o** `error.headers` (numérico o fecha HTTP).
2. Regex sobre el message: `/try again in\s*([\d.]+)\s*(ms|s|seconds?)\b/i` → `"3.8775s"` = 3877ms, `"652.5ms"` = 652ms.
3. Fallback: backoff exponencial previo (sin cambio).

Se mantiene el chequeo de `budgetDeadline` (`AI_TOTAL_BUDGET_MS`): si el retry-after no entra en presupuesto, se abandona igual que antes.

### Nota estructural
El prompt pide ~3.200 tokens contra un límite de **8.000 TPM** (free tier de Groq para `openai/gpt-oss-120b`) → máximo ~2 llamadas/minuto. Queda pendiente (no hecho por decisión): reducir prompt o throttle cliente si los 429 siguen siendo frecuentes.

### Tests (+5)
Header raíz groq-sdk · hint en segundos · hint en ms · prioridad header > message · backoff por defecto sin hint.

---

## Fix 2 — Descartar ejercicios desconocidos y continuar

**Archivos:** `src/modules/training-plan/plan-materializer/plan-materializer.service.ts` (+spec), `src/modules/training-plan/plan-generator/plan-generator.service.spec.ts`

### Antes
Cualquier nombre irresoluble (L1 exact → L2 folded → L3 subset → L4 levenshtein) tiraba toda la generación con 400 `AI_UNKNOWN_EXERCISE_NAME`.

### Ahora — nuevo comportamiento de `resolveExercisesByName()`
1. Los nombres genuinamente irresolubles se **descartan** del plan con WARN (incluye sugerencias "¿quiso decir?" para diagnóstico).
2. Un día que queda sin ejercicios tras el descarte pasa a `isRest = true` (invariante: isRest ⇔ día sin ejercicios).
3. Solo lanza 400 (`AI_UNKNOWN_EXERCISE_NAME`) si **ningún** ejercicio del plan resolvió contra el catálogo (plan inservible).
4. La generación parcialmente descartada se audita como `TRAINING_PLAN_GENERATED success=true`.

Downstream ya tolera días sin sesión: `buildWeekLogFromPlan` solo crea WorkoutSession si hay ejercicios, y `confirmAsRoutinePlan` filtra `!isRest && exercises.length > 0`.

### Tests actualizados
Materializer: descarte parcial continúa con válidos · día→rest cuando todos sus ejercicios se descartan · 400 solo si TODOS son irresolubles.
Generator spec: "rechaza con 400..." → reemplazado por "descarta... y genera con los válidos" (audita éxito).

---

## Fix 3 — Deduplicación completa del catálogo

### Causa raíz de los duplicados
El seed usa `insertMany` (`seed-runner.ts`) que **bypassea** el guard anti-duplicados de `ExerciseService.create()` (que sí compara `normalizedName`). El índice único existente estaba solo sobre `name` crudo (case-sensitive), así que variantes de mayúscula pasaban.

### a) Migración `004-dedupe-exercises.migration.ts`
`npm run migration:dedupe-exercises` — **dry-run por defecto**, escribe con `-- --apply`.

- **Pass A:** agrupa por `normalizedName` exacto (cubre `"Remo con mancuerna"/"Remo con Mancuerna"`).
- **Pass B:** agrupa por clave folded (`foldTokens`, tokens singularizados — cubre `"Sentadilla"/"Sentadillas"`, `"Elevación(es) de piernas"`).
- Conserva el canónico (más antiguo por `createdAt`), repuntea referencias y borra duplicados.
- Repointeo en las 5 colecciones que referencian Exercise:

| Colección | Campo |
|-----------|-------|
| `routinedays` | `exercises[].exercise` |
| `workoutsessions` | `exercises[].exerciseId` |
| `usertrainingpreferences` | `favoriteExercises[]` |
| `userpersonalrecords` (stats) | `exerciseId` |
| `usertopexercises` (stats) | `exerciseId` |

- Al final crea explícitamente el índice único en `exercises.normalizedName`.

### b) Seed dedup (`seed-runner.ts`)
Antes del `insertMany` inicial se deduplica `SEEDED_EXERCISES` por `normalizedName`; loguea cuántos duplicados omitió. Evita reintroducir dupes en DBs nuevas.

### c) Índice único (`exercise.schema.ts`)
```typescript
ExerciseSchema.index({ normalizedName: 1 }, { unique: true, sparse: true });
```
`sparse` tolera documentos legacy sin `normalizedName` (el seed ya hace backfill). Con `autoIndex` activo, mongoose intenta crearlo al arrancar: si aún quedan dupes, MongoDB loggea E11000 en background (no tira la app) hasta correr la migración.

---

## Verificación

| Check | Resultado |
|-------|-----------|
| `npx jest --config jest.config.js src/modules/ai` | ✅ 31 tests |
| `npx jest --config jest.config.js src/modules/training-plan` | ✅ 105 tests |
| Suite completa `npx jest --config jest.config.js` | ✅ **59 suites / 586 tests** |
| `npm run build` | ✅ |
| `npm run lint` | ✅ 0 errores (21 warnings preexistentes, sin relación) |

## Pasos para aplicar en el entorno con datos

```bash
# 1. Ver qué fusionaría (no toca datos)
npm run migration:dedupe-exercises

# 2. Aplicar
npm run migration:dedupe-exercises -- --apply

# 3. Verificación opcional post-limpieza
npm run check:similar-exercises
```

## Archivos tocados

```
M  package.json                                                    (+1 script)
M  src/database/seed-runner.ts                                     (dedup seed)
A  src/database/migrations/004-dedupe-exercises.migration.ts       (nueva)
M  src/modules/ai/ai.service.ts                                    (retry-after)
M  src/modules/ai/ai.service.spec.ts                               (+5 tests)
M  src/modules/routines/templates/exercise/schema/exercise.schema.ts (índice único)
M  src/modules/training-plan/plan-materializer/plan-materializer.service.ts      (descartar)
M  src/modules/training-plan/plan-materializer/plan-materializer.service.spec.ts (+tests)
M  src/modules/training-plan/plan-generator/plan-generator.service.spec.ts       (test adaptado)
```

## Pendientes futuros (no hechos)

- Reducir tamaño del prompt (~3.2k tokens vs 8k TPM free tier) o agregar throttle entre llamadas IA.
- Considerar self-correction con feedback a la IA si el descarte parcial resulta frecuente.
