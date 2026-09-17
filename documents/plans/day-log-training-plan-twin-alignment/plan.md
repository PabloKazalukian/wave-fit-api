# Plan: Alineación gemela day-log ↔ training-plan (Spec ↔ Código)

> **Status:** Historical / Non-Authoritative
> **Spec relacionadas:** `sdd/day-log.spec.md`, `sdd/training-plan.spec.md`
> **Contexto:** auditoría de ambos módulos como "módulos gemelos" (las 2 formas que el usuario puede adoptar: solo día / plan semanal con IA).

## Status

Plan ejecutado en su totalidad (Fases 1–5) el 2026-09-14. No es autoritativo: la fuente de verdad son los Specs y el Código.

---

## 1. Decisión de dirección

Edicto del usuario: **"no inventes, solo lo que está en el código manda"**.

- Para las contradicciones Spec ↔ Código, el **código manda** → se actualizan los Specs (SDD) cuando el código es la verdad estable.
- Para las asimetrías gemelas, se alinea lo que tiene patrón establecido en el propio código (de uno de los dos gemelos), sin inventar comportamiento.
- Decisiones confirmadas por el usuario (2026-09-14):
  1. **Colección día-log** → se actualiza el Spec a `daylogs` (realidad del código, auto-naming de Mongoose). NO se agrega `collection: 'day_logs'`.
  2. **Paginación `dayLogFindAll`** → se mantiene el array `[DayLog]` con limit/offset; se documenta la diferencia vs `TrainingPlanPage`. NO se crea `DayLogPage`.
  3. **Errores de day-log** → se alinean a `HttpException` (404/400) como training-plan. SÍ se cambia.

---

## 2. Hallazgos de la auditoría

### 2.1 Contradicciones Spec ↔ Código

| # | Spec dice | Código hace | Acción |
|---|---|---|---|
| 1 | `training-plan.spec.md:66` y `documents/modules/training-plan.md:80`: el módulo "exports `ConfirmPlanService`" | `src/modules/training-plan/training-plan.module.ts:54` exporta `TrainingPlanService`. Nadie importa `ConfirmPlanService` externamente (grep: solo provider interno consumido por el resolver) | Actualizar Spec + doc (código manda) |
| 2 | `day-log.spec.md` FR-001 / Constraints / Files: colección `day_logs` | `DayLogSchema` (`src/modules/routines/tracking/day-log/infrastructure/schemas/day-log.schema.ts:10`) no declara `collection:` → Mongo auto-nombra **`daylogs`** (convención de los módulos de tracking: WeekLog/RoutineDay/WorkoutSession también auto-nombran; `day_logs` solo aparece en el Spec, en ninguna parte de `src/`/`test/`) | Actualizar Spec a `daylogs` (decisión 1) |
| 3 | `day-log.spec.md` FR-002 / NFR-002: timezone *opcional* con default `'America/Argentina/Buenos_Aires'` | `CreateDayLogInput.timezone` es **obligatorio** (`presentation/dto/create-day-log.input.ts:21-23`, no null, `@IsString`). El default solo existe en update (`application/use-cases/update-day-log.use-case.ts:18`) y en `WorkoutSessionService.create` (`workout-session.service.ts:51`) | Cambiar código: `timezone?` + fallback `DEFAULT_TIMEZONE` en create (decisión 3/tiempo) |

### 2.2 Divergencia de errores (bug gemelo) → alinear a HttpException

- `application/use-cases/create-day-log.use-case.ts:36-38` → `new Error(...)` para fecha semánticamente inválida (`isValidLocalDate` falla con regex válida, ej. `2025-02-31`) → **500 INTERNAL_SERVER_ERROR**. Debe ser `BadRequestException` (400).
- `application/use-cases/update-day-log.use-case.ts:38-40` → `new Error(...)` cuando `dayLogRepository.findOne` devuelve null → **500**. Debe ser `NotFoundException` (404), gemelo de `updateTrainingPlan` (`'Training plan not found'`).
- `application/use-cases/update-day-status.use-case.ts:28-30` → `new Error(...)` para fecha inválida → **500**. Debe ser `BadRequestException`.
- `removeDayLog` (`RemoveDayLogUseCase` → `findByIdAndSoftDelete`) devuelve `null` (GraphQL `null`) si el id no existe o no es del usuario; `removeTrainingPlan` lanza 404. Debe lanzar `NotFoundException`.

Riesgo bajo: los unit specs actuales matchean texto por substring (`rejects.toThrow('no encontrado')` en `update-day-log.use-case.spec.ts:81-83`). Se conservan los mensajes.

### 2.3 Asimetrías aceptadas (se documentan, NO se tocan)

- **Paginación**: `trainingPlans` → `TrainingPlanPage {items,total,limit,offset,totalPages}` vs `dayLogFindAll` → `[DayLog]` (aplica limit/offset, sin total/pages). Decisión: mantener array, documentar en Spec (decisión 2).
- **Audit**: day-log → `AuditInterceptor` + `@Audit` en el resolver; training-plan → `AuditLogsService.logAsync` dentro de los servicios (con metadata rica y `code` de `AI_CAUSE`). Ambos fieles a sus respectivos specs (day-log NFR-003, training-plan FR-010).
- **Delete**: `removeTrainingPlan` = físico (`findOneAndDelete`); `removeDayLog` = soft delete (`deleted:true`/`deletedAt`). Ambos fieles a sus specs (day-log prohíbe el borrado físico).
- `updateDayStatus(date, isRest)` valida `date` pero opera sobre el día **activo** (`findActive(userId)`); el parámetro `date` no se usa para localizar. Observación sin acción (no se puede inferir intención).

---

## 3. Fases de ejecución

### Fase 1 — Alinear contrato de errores de day-log (código + tests)

Archivos:
- `src/modules/routines/tracking/day-log/application/use-cases/create-day-log.use-case.ts:36-38` → `BadRequestException` (mismo mensaje).
- `src/modules/routines/tracking/day-log/application/use-cases/update-day-log.use-case.ts:38-40` → `NotFoundException` (mismo mensaje).
- `src/modules/routines/tracking/day-log/application/use-cases/update-day-status.use-case.ts:28-30` → `BadRequestException`.
- `src/modules/routines/tracking/day-log/application/use-cases/remove-day-log.use-case.ts` → `NotFoundException` si `findByIdAndSoftDelete` retorna `null`.
- Unit specs: ajustar si alguno asertaba el tipo genérico `Error`; mantener mensajes para no romper los substring-matches.
- e2e: agregar asserts en `test/e2e/day-log/crud.spec.ts` (update/remove de id inexistente → extensión `NOT_FOUND`).

### Fase 2 — timezone opcional en create (código + tests)

Archivos:
- `src/modules/routines/tracking/day-log/presentation/dto/create-day-log.input.ts` → `timezone?: string` + `@IsOptional()` + `@Field(() => String, { nullable: true })`.
- `src/modules/routines/tracking/day-log/application/use-cases/create-day-log.use-case.ts` → `localDateToUtc(localDate, timezone ?? DEFAULT_TIMEZONE)` con `const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires'` local (mismo patrón que `update-day-log.use-case.ts:18`).
- `update-day-log.input.ts` ya hereda de `PartialType(CreateDayLogInput)` → sin cambio.
- Unit: agregar caso "sin timezone → usa DEFAULT_TIMEZONE" en `create-day-log.use-case.spec.ts`.
- Retrocompatible: el campo pasa de requerido a opcional.

### Fase 3 — Actualizar Specs (SDD)

Archivos:
- `sdd/training-plan.spec.md:66` → `exports TrainingPlanService`.
- `sdd/day-log.spec.md`:
  - FR-001 / Constraints / Files: `day_logs` → `daylogs` (colección auto-nombrada por convención de tracking).
  - FR-002: timezone opcional + default en create y update (verdad tras Fase 2).
  - FR-011: documentar que `dayLogFindAll` retorna `[DayLog]` (contraste gemelo con `trainingPlans` → `TrainingPlanPage`).
  - FR-012 / BR: documentar el contrato de errores alineado (404 update/remove de id inexistente; 400 fecha inválida).
  - Tests: ajustar IDs/descripciones de los unit/e2e que cubren Fase 1–2.
- `sdd/README.md`: sin cambios (estados ya `done`).

### Fase 4 — Documentación estable

- `documents/modules/training-plan.md:80` → export a `TrainingPlanService`.
- Crear `documents/modules/day-log.md` como gemelo de `training-plan.md` (estado del módulo, API GraphQL, colección `daylogs`, timezone/`DEFAULT_TIMEZONE`, contrato de errores, integración `activeTracking`, tests). Solo después de Fases 1–3 (regla AGENTS.md: docs post-validación).

### Fase 5 — Validación canónica

```bash
npm run build
npm run lint
npm test
npm run test:e2e
```

Targeted durante desarrollo:
```bash
npx jest --config jest.config.js src/modules/routines/tracking/day-log
npx jest --config ./test/jest-e2e.json test/e2e/day-log/
npx jest --config ./test/jest-e2e.json test/e2e/training-plan/
```

---

## 4. Fuera de alcance (observado, sin acción salvo pedido)

- Dead code en `day-log.repository.ts`: `delete()`, `findRaw()`, `findActiveRaw()` sin call sites en `src/` (solo `updateStatus` se usa). No se toca salvo pedido explícito.
- Entidad `DayLog.date: Date` vs `GraphQLISODateTime` en training-plan (cosmético).
- Args `dayLogFindAll` tipados `Number` vs `Int` en `trainingPlans` (cosmético).
- `updateDayStatus(date, isRest)`: parámetro `date` sin uso para localizar (ver §2.3).