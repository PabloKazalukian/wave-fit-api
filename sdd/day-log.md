---
title: Day-log completo (día suelto de entrenamiento)
description: Cerrar el scaffold de day-log: entidad de dominio, schema Mongoose, repositorio y use cases reales, con tests.
status: draft
priority: alta
created: 2026-09-09
updated: 2026-09-09
depends_on: 
---

# Day-log completo

## Context

El usuario necesita registrar un día de entrenamiento **sin semana completa** (ad-hoc, fuera del plan semanal). El módulo `day-log` hoy es un scaffold de NestJS CLI: el resolver expone las operaciones GraphQL (`createDayLog`, `dayLogFindAll`, `dayLogFindOne`, `updateDayLog`, `removeDayLog`) pero los 5 use cases y el service retornan strings placeholder, `domain/` e `infrastructure/` no existen, y el schema/DTOs tienen un `exampleField` de ejemplo (ver `AGENTS.md §14`).

**Decisiones de negocio confirmadas con el usuario (2026-09-09):**
- Colección propia `day_logs` con schema dedicado (NO reusa WorkoutSession).
- Un bloque de ejercicios embebidos (`exerciseId`, `series`, `sets[]`) con un `status` global del día.
- Ciclo de vida: `status` enum + soft-delete (`deleted`/`deletedAt`) + `timestamps`.

## Requirements

### MUST

1. Crear la entidad de dominio `DayLogDomain` en `src/modules/routines/tracking/day-log/domain/entities/day-log.domain.ts` con factory estática `create()`. Campos: `id`, `userId`, `date: Date` (UTC), `exercises` (mismo shape que `ExercisePerformance`), `status`, `notes?`, `edited`, `deleted`, `deletedAt?`. Defaults: `status='pending'`, `deleted=false`, `edited=false`.
2. Definir la interfaz `IDayLogRepository` en `domain/interfaces/repositories/day-log.repository.interface.ts` con token `DAY_LOG_REPOSITORY`. Métodos: `create`, `findOne(id, userId)`, `findAllByUser(userId)`, `findByIdAndUpdate(id, userId, update, options)`, `softDelete(id, userId)`. Todos los métodos de lectura excluyen documentos con `deleted: true` salvo que se indique lo contrario.
3. Crear el schema Mongoose `DayLog` (colección `day_logs`) en `infrastructure/schemas/day-log.schema.ts` con `@Schema({ timestamps: true })`, sub-schema de ejercicios reutilizando `ExercisePerformanceSchema`/`SetPerformanceSchema` de workout-session, `status` con enum `['pending','in_progress','complete','skipped']`, `deleted`/`deletedAt`, e índices `{ userId: 1, date: 1 }` y `{ userId: 1, deleted: 1 }`.
4. Implementar `DayLogRepository` en `infrastructure/repositories/day-log.repository.ts` mapeando documento Mongoose ↔ `DayLogDomain` (ObjectId ↔ string, igual que `week-log.repository.ts`).
5. `createDayLog`: el input recibe `date` como **LocalDate** (`string` "yyyy-MM-dd") y `timezone?` (default `'America/Argentina/Buenos_Aires'`). Convierte a **Date UTC** con `localDateToUtc` de `src/common/utils/date.utils` (mismo criterio que `week-log.domain.ts:153`). Rechaza fechas inválidas con `isValidLocalDate`. Persiste vía repositorio y devuelve la entidad GraphQL.
6. `dayLogFindAll` devuelve solo los day-logs del usuario autenticado, sin soft-deleted, ordenados por `date` descendente.
7. `dayLogFindOne(id)` lanza `NotFoundException` si no existe; valida pertenencia al usuario (aislamiento: el día de otro usuario NO es visible) con `ForbiddenException`.
8. `updateDayLog(id, input)` actualiza parcialmente (`exercises`, `status`, `notes`, `date?` con validación LocalDate) solo si es del usuario y no está borrado. Devuelve el documento actualizado.
9. `removeDayLog(id)` hace soft-delete: `deleted=true` + `deletedAt=now`, devuelve la entidad actualizada. No borra físicamente.
10. `DayLogService` delega en los 5 use cases y expone métodos con la misma firma que hoy (`create`, `findAll`, `findOne`, `update`, `remove`). El service recibe `userId` desde el contexto.
11. El resolver queda protegido con `@UseGuards(GqlAuthGuard)` y obtiene `userId` con `extractUserId(context)`. Firma GraphQL: `createDayLog(input)`, `dayLogFindAll`, `dayLogFindOne(id: String!)`, `updateDayLog(updateDayLogInput)`, `removeDayLog(id: String!)`, todas `@Args` con `id` como `String` (`@Args('id', { type: () => ID })`). Se elimina cualquier resto del scaffold (`exampleField`, `Int`).
12. `DayLogModule` registra `MongooseModule.forFeature([{ name: DayLog.name, schema: DayLogSchema }])` y como providers: resolver, service, validator, los 5 use cases y el repositorio bajo `DAY_LOG_REPOSITORY` (patrón de `week-log.module.ts:27`).
13. Cada `MUST` debe tener al menos un test unitario que lo cubra, y el estado final pasa la suite completa de la spec (`Tests to Run`).

### SHOULD

1. Mantener los decoradores de audit (`@UseInterceptors(AuditInterceptor)` + `@Audit` en mutations, como en `workout-session.resolver.ts`) y el módulo `AuditLogsModule` importado si el validador o los use cases lo requieren.
2. Reutilizar los métodos del `DayLogValidator` existente (`validateCreation`, `validateOwnership`, `validateUpdate`) en los use cases.
3. Añadir un spec E2E (`test/e2e/day-log/day-log.spec.ts`) que cubra create, findOne, update, soft-delete, y aislamiento entre dos usuarios.

### MAY

1. Paginación en `dayLogFindAll` (`limit`/`offset`).
2. Emisión de eventos para stats (`workout-session.saved` no aplica; dejarlo documentado como fuera de alcance de esta spec).

## ai_instructions

1. Leer `AGENTS.md` y `documents/config/testing.md` antes de tocar código.
2. Seguir el patrón hexagonal de `week-log` (carpetas domain/interfaces, infrastructure/schemas, infrastructure/repositories) — NO inventar otra estructura.
3. Test-first por capa: escribir los tests de cada capa (domain → infra → use cases → presentación) antes de la implementación de esa capa.
4. Fechas SIEMPRE como `LocalDate` en el input y `Date UTC` en MongoDB (`localDateToUtc`). No usar `Date.now()` para fechas de calendario.
5. Los 5 use cases existentes se reescriben (reemplazan los placeholders con strings). Los DTOs/entidades `exampleField` se reemplazan por el modelo real.
6. El `id` en GraphQL/use cases es `string`, nunca `number`/`Int`.
7. Verificar con los comandos de la sección `Tests to Run`. NO dejar rojos en suites existentes (week-log, workout-session, etc.).
8. No tocar archivos fuera de `Files to Change`.

## tech_context

- **Patrón de referencia (hexagonal):** `src/modules/routines/tracking/week-log/`
  - Entidad de dominio con factory: `week-log/domain/entities/week-log.domain.ts` (`WeekLogDomain.createFromPlan` col. 153)
  - Interfaz repositorio + token: `week-log/domain/interfaces/repositories/week-log.repository.interface.ts` (`WEEK_LOG_REPOSITORY` col. 9)
  - Schema Mongoose: `week-log/infrastructure/schemas/week-log.schema.ts` (soft-delete cols. 63-67, índices cols. 74-76)
  - Módulo (forFeature + providers + token): `week-log/week-log.module.ts` cols. 27-56
- **Schema de ejercicios a reutilizar:** `workout-session/schema/exercise-performance.schema.ts` y `workout-session/schema/set-performance.schema.ts`
- **DTOs de exercise a imitar:** `workout-session/dto/create-workout-session.input.ts` (`ExercisePerformanceInput`, `SetPerformanceInput`, validación class-validator)
- **Schema de workout-session (modelo de campos):** `workout-session/schema/workout-session.schema.ts` (userId col. 16, date col. 22, exercises col. 28, status col. 31, notes col. 34, soft-delete cols. 37-44)
- **Utils de fecha:** `src/common/utils/date.utils` → `localDateToUtc`, `isValidLocalDate`, `nowUtc`
- **Utils de contexto:** `src/common/utils/user-id.utils` → `extractUserId(context)`
- **Default timezone:** `'America/Argentina/Buenos_Aires'` (ver `workout-session.service.ts:24`)
- **Resolver con guard + context:** `workout-session/workout-session.resolver.ts` (`@UseGuards(GqlAuthGuard)`, `extractUserId`)
- **Validator scaffold a completar:** `day-log/application/validators/day-log.validator.ts`
- **Use cases scaffold (a reescribir):** `day-log/application/use-cases/*.use-case.ts` (retornan strings; ej. `create-day-log.use-case.ts:7`)

## References

- `AGENTS.md §14` (Day-Log — estado y próximos pasos)
- `documents/config/testing.md` (patrones de mocks, configuración Jest, E2E con mongodb-memory-server)
- `src/modules/routines/tracking/week-log/` (patrón hexagonal completo)
- `src/modules/routines/tracking/workout-session/` (schema de ejercicio, resolver, service, DTOs)

## Files to Change

- [-] `src/modules/routines/tracking/day-log/domain/entities/day-log.domain.ts`
- [-] `src/modules/routines/tracking/day-log/domain/interfaces/repositories/day-log.repository.interface.ts`
- [-] `src/modules/routines/tracking/day-log/infrastructure/schemas/day-log.schema.ts`
- [-] `src/modules/routines/tracking/day-log/infrastructure/repositories/day-log.repository.ts`
- [+] `src/modules/routines/tracking/day-log/application/use-cases/create-day-log.use-case.ts`
- [+] `src/modules/routines/tracking/day-log/application/use-cases/find-all-day-logs.use-case.ts`
- [+] `src/modules/routines/tracking/day-log/application/use-cases/find-one-day-log.use-case.ts`
- [+] `src/modules/routines/tracking/day-log/application/use-cases/update-day-log.use-case.ts`
- [+] `src/modules/routines/tracking/day-log/application/use-cases/remove-day-log.use-case.ts`
- [+] `src/modules/routines/tracking/day-log/application/validators/day-log.validator.ts`
- [+] `src/modules/routines/tracking/day-log/presentation/dto/create-day-log.input.ts`
- [+] `src/modules/routines/tracking/day-log/presentation/dto/update-day-log.input.ts`
- [+] `src/modules/routines/tracking/day-log/presentation/dto/day-log-exercise.input.ts`
- [+] `src/modules/routines/tracking/day-log/presentation/entities/day-log.entity.ts`
- [+] `src/modules/routines/tracking/day-log/presentation/entities/day-log-exercise.entity.ts`
- [+] `src/modules/routines/tracking/day-log/day-log.service.ts`
- [+] `src/modules/routines/tracking/day-log/day-log.resolver.ts`
- [+] `src/modules/routines/tracking/day-log/day-log.module.ts`
- [-] `src/modules/routines/tracking/day-log/day-log.spec…` (domain/repo/use-cases/service/resolver — ver abajo)

## Unit Tests to Implement

- `day-log/domain/entities/day-log.domain.spec.ts` — factory `create()`: defaults (`pending`, `deleted=false`) y campos.
- `day-log/infrastructure/repositories/day-log.repository.spec.ts` — mapeos doc↔domain, `softDelete` setea `deleted/deletedAt`, exclusión de borrados en queries.
- `day-log/application/use-cases/create-day-log.use-case.spec.ts` — conversión LocalDate→UTC (con/sin timezone), rechazo de fecha inválida, persistencia.
- `day-log/application/use-cases/find-all-day-logs.use-case.spec.ts` — filtra por userId, excluye soft-deleted, orden por fecha desc.
- `day-log/application/use-cases/find-one-day-log.use-case.spec.ts` — NotFound si no existe, Forbidden si es de otro usuario.
- `day-log/application/use-cases/update-day-log.use-case.spec.ts` — actualización parcial, ownership, rechaza update de borrado.
- `day-log/application/use-cases/remove-day-log.use-case.spec.ts` — soft-delete (no física), devuelve entidad actualizada.
- `day-log/day-log.service.spec.ts` — delega en los 5 use cases.
- `day-log/day-log.resolver.spec.ts` — reescribir el spec existente para el nuevo resolver (guards, args con `ID`).
- (SHOULD) `test/e2e/day-log/day-log.spec.ts` — CRUD completo + aislamiento entre usuarios.

## Tests to Run

```bash
npx jest --config jest.config.js src/modules/routines/tracking/day-log
npm run build
npm run lint
npm test
npm run test:e2e
```

## Failure Analysis

| Síntoma | Causa probable | Acción |
|---------|----------------|--------|
| El resolver recibe `id` como número (error de tipo GraphQL) | No se reemplazó `Int` por `ID`/`String` en resolver y DTOs | Corregir firmas en `day-log.resolver.ts` y `update-day-log.input.ts` |
| Fechas corridas de día (timezone) | Se guardó `new Date()` local en vez de `localDateToUtc` | Revisar use case create/update contra MUST 5 y 8 |
| Otro usuario ve/edita un day-log ajeno | Falta `validateOwnership` / filtro `userId` en repo | Revisar findOne/update/remove contra MUST 7-9 |
| Tile lint: import cycle entre day-log y workout-session | Importar sub-schemas `ExercisePerformanceSchema`/`SetPerformanceSchema` desde workout-session crea acoplamiento | Mover los sub-schemas compartidos a `src/common/schemas/` si persiste |
| Suite week-log/workout-session roja tras el cambio | Se modificó algo fuera del checklist o dependencia compartida | Revertir el cambio ajeno y correr `Tests to Run` |