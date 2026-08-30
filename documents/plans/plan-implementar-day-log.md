# Plan: Implementar Day-Log + capa centralizada de actividad activa (`activeTracking`) + activación de `distributionDays`

> Fecha: 2026-08-29
> Estado: Aprobado. Trabajando en rama `feat/day-log` (backend). Front en rama paralela (otro repo).

---

## 1. Contexto y hallazgo clave

El campo **`distributionDays`** ya existe **dormido** en el schema de UserProfile:

`src/modules/user/user-profile/schema/user-profile.schema.ts`

```ts
export enum DistributionDays {
  WEKK = 'Week-log',     // <-- typo: WEKK, valores en PascalCase con guión
  DAY  = 'Day-log',
}
...
@Prop({ type: String, enum: DistributionDays, default: DistributionDays.WEKK })
distributionDays: DistributionDays;
```

Está **solo a nivel de schema**. NO está expuesto en:
- la entidad GraphQL (`entities/user-profile.entity.ts`),
- los DTOs (`create-user-profile.input.ts`, `update-user-profile.input.ts`),
- el service (`user-profile.service.ts`) — ni se lee ni se escribe,
- el contexto para IA (`buildUserContextForAI()` en `user-profile.utils.ts`),
- ningún módulo de tracking.

Es el punto de entrada natural para que el usuario elija entre **week-log** (plan semanal) y **day-log** (día suelto).

---

## 2. Fuente de la verdad de "qué está activo" — estado actual (backend)

Hoy la consulta de actividad vive **dentro de week-log**:

- `week-log.resolver.ts:76` → `@Query activeWeekLog` → `ActiveWeekLogResponse { hasActiveWeek: boolean, week?: WeekLog }`.
- `week-log.resolver.ts:89` → `@Query currentWorkoutSession` → devuelve la misma semana activa (alias que confunde: no trae una sesión, trae el week-log activo).
- Internamente: `weekLogService.findActiveWeekLog(userId)` → `FindActiveWeekLogUseCase` → `repository.findActive(userId)` (busca `{userId, active:true, deleted:{$ne:true}}`).

**Consecuencias hoy:**
- Solo existe la noción de **semana activa**. No hay capa para day-log (aún no se implementa).
- El front, hoy: consulta `activeWeekLog` para saber si hay semana activa, y **cancela/finaliza** directo llamando a las mutaciones de week-log (`updateWeekLog` con `completed=true`, o `removeWeekLog`).
- El registro de "activo" está **disperso** en cada módulo de tracking (week-log conoce su `active`), no centralizado.

---

## 3. Objetivo y rediseño

1. Activar `distributionDays` en user-profile (predeterminado / gate blando).
2. Implementar el módulo **day-log** completo con arquitectura hexagonal (4 capas), replicando la orquestación de **WorkoutSession / ExtraSession** como sub-recursos (patrón de week-log).
3. Regla de **unicidad del activo**: crear week-log O day-log exige que **no haya nada activo** (ni el mismo valor ni el otro).
4. **Separación lectura/escritura** para la fuente de la verdad de actividad:
   - **Escritura** (crear / activar / cancelar / finalizar): sigue directo a week-log / day-log (el front usa el `type` + `id` de la consulta unificada para saber qué módulo tocar).
   - **Lectura** ("¿qué está activo?"): pasa a una **capa nueva unificada** `activeTracking` que consulta ambos repos y devuelve **DL o WL**.

### Contrato de la capa de lectura (Fase D)

```graphql
enum TrackingType { WEEK_LOG DAY_LOG }

type ActiveTracking {
  hasActive: Boolean!
  type: TrackingType        # WEEK_LOG | DAY_LOG | null
  week: WeekLog             # presente si type = WEEK_LOG
  day:  DayLog              # presente si type = DAY_LOG
}

type Query {
  activeTracking: ActiveTracking!   # reemplaza (con transición) a activeWeekLog
}
```

- `ActiveTrackingService` inyecta `WEEK_LOG_REPOSITORY` + `DAY_LOG_REPOSITORY`, consulta `findActive` en ambos y arma el DTO.
- **Escritura no cambia**: el front cancela/finaliza contra el módulo correcto según `activeTracking.type`.

---

## 4. Decisiones de diseño acordadas

| Decisión | Elección |
|----------|----------|
| **Punto de entrada** | Activar `distributionDays` existente (no migrarlo a training-preference). |
| **Forma del documento DayLog** | **Sin array `days[]`**: un único `workoutSessionId`, `extraSessionIds[]` y `status` en el root (día suelto = una sesión principal). |
| **Alcance de operaciones** | create / findAll / findOne / update / remove + assignRoutineToDay + updateDayStatus + removeWorkoutSession + removeExtraSession. Equivalente activo: `findActiveDayLog`. Sin `syncWeekLogDays`. |
| **`distributionDays` como gate** | **Gate blando**: preferencia por defecto en el front; **nunca bloquea** la creación del otro tipo. La única regla dura es la unicidad del activo. |
| **Unicidad del activo** | Crear week-log o day-log exige no tener nada activo (ni el mismo ni el otro). `ConflictException` si lo hay. |
| **Capa de lectura** | `activeTracking` unificada (Fase D). |
| **`activeWeekLog`/`currentWorkoutSession`** | **Mantener deprecados durante la transición**; el front (rama nueva) migra a `activeTracking`; se eliminan en iteración posterior. |
| **Normalización typo `WEKK`** | A confirmar al implementar: se propone normalizar a `WEEK` (valores snake_case `'week_log'`/`'day_log'`) con compatibilidad de lectura de docs existentes. Alternativa: activar sin renombrar. |

---

## 5. Estrategia de ramas (git)

- **Backend:** rama **`feat/day-log`** (creada desde `langchain`). La rama actual queda intacta y funcional.
- **Front (otro repo):** rama paralela para migrar a la nueva API:
  - Leer/exponer `distributionDays` y usarlo como default de tipo a crear (con flexibilidad de elegir).
  - Migrar la consulta de actividad de `activeWeekLog` → `activeTracking`.
  - Usar `activeTracking.type`/`id` para cancelar contra el módulo correcto.

---

## 6. Estructura de fases

> Incremental: cada fase se puede validar/mergear por separado.

### FASE A — Activar `distributionDays` en UserProfile

**Archivos:**
- `schema/user-profile.schema.ts` — decidir normalización del typo/valores (ver §4).
- `entities/user-profile.entity.ts` — exponer `distributionDays` (GraphQL `ObjectType`).
- `dto/create-user-profile.input.ts`, `dto/update-user-profile.input.ts` — añadir campo validado (enum / `IsIn`).
- `service/user-profile.service.ts` — leer/escribir `distributionDays` en create/update/upsert.
- `user-profile.utils.ts` (`buildUserContextForAI`) — incluir `distributionDays` en el contexto de IA.
- Migración de datos si se normalizan valores.

**Criterio de aceptación:** `updateUserProfile`/`upsertUserProfile` pueden fijar y leer `distributionDays`; el frontend puede consultarlo.

---

### FASE B — Implementar el módulo Day-Log (operativo, hexagonal)

#### B.1 `infrastructure/schemas/day-log.schema.ts`
Modelo de día único (sin array):

```ts
@Schema({ timestamps: true })
class DayLog {
  userId: ObjectId ref User          // required, index
  date: Date                         // UTC, required
  planId?: ObjectId ref RoutinePlan  // default null
  routineDayId?: ObjectId ref RoutineDay // opcional (si viene de rutina)
  workoutSessionId?: ObjectId ref WorkoutSession  // nullable (ref, no embebido)
  extraSessionIds: ObjectId[] ref ExtraSession    // default []
  status: enum ['pending','complete','skipped']   // default 'pending'
  active: boolean                    // default true, index
  completed: boolean                 // default false
  notes?: string                     // default ''
  deleted: boolean                   // default false
  deletedAt?: Date
}
// Indexes: {userId,date}, {userId,active}, {workoutSessionId}, {extraSessionIds}
```

Referencias a WS/ES por ObjectId (mismo mecanismo que week-log: `populate('workoutSessionId')` / `populate('extraSessionIds')`).

#### B.2 `domain/`
- `entities/day-log.domain.ts` — `DayLogDomain` (getters/setters de `status`, `active`, `workoutSessionId`, `extraSessionIds`, `notes`) + factory que, dado un plan/rutina, genera `WorkoutSessionCreationData` (análogo a `WeekLogDomain.createFromPlan`).
- `interfaces/repositories/day-log.repository.interface.ts` — token `DAY_LOG_REPOSITORY` + `IDayLogRepository` (findOne, findAllByUser, findActive, create, updateDayField, updateStatus, findRaw, findByIdAndSoftDelete, delete).

#### B.3 `infrastructure/repositories/day-log.repository.ts`
Implementación con populate + `mapToDomain` (patrón de `week-log.repository.ts`).

#### B.4 `application/use-cases/` (reemplazar los 5 stubs)
- `create-day-log.use-case` — valida fecha/ownership, verifica **exclusividad interna** (no day-log activo) y (en Fase C) **exclusividad cruzada** (no semana activa); construye dominio, crea WS vía `WorkoutSessionService` si aplica, persiste ref. Firma prevista: `execute(input, userId)`.
- `find-all-day-logs.use-case` / `find-one-day-log.use-case`.
- `update-day-log.use-case` — actualiza `notes`/`active`/`completed` + opcional WS/ES (mismo mecanismo `processDay` de week-log).
- `remove-day-log.use-case` — soft delete.
- `update-day-status.use-case` — equivalente a `updateDayWorkoutStatus` (isRest → `skipped` + elimina WS; activo → `pending` + crea/limpia WS).
- `assign-routine-day.use-case` — carga `RoutineDay`, construye ejercicios, crea/actualiza la WS del día.
- `remove-workout-session.use-case` / `remove-extra-session.use-case` — quitan ref del day-log y borran el doc real.
- `day-log.validator.ts` — `validateCreation` (fecha + exclusividad), `validateOwnership` (ya escrito), `validateUpdate`.
- Actualizar `application/use-cases/index.ts` (`DAY_LOG_USE_CASES`).

#### B.5 `service/day-log.service.ts`
Orquestador (como `WeekLogService`): inyecta repositorio + use cases + `WorkoutSessionService`/`ExtraSessionService`/`RoutineDayService`. Cada método público delega en un use case y devuelve dominio. Expone `findActiveDayLog`.

#### B.6 `day-log.module.ts`
- `MongooseModule.forFeature([DayLog, WorkoutSession])`.
- Importar `AuditLogsModule`, `WorkoutSessionModule`, `ExtraSessionModule`, `RoutineDayModule` (`forwardRef` donde haga falta por ciclos).
- Providers: `DayLogResolver`, `DayLogService`, `DayLogValidator`, `...DAY_LOG_USE_CASES`, `{ provide: DAY_LOG_REPOSITORY, useClass: DayLogRepository }`.
- Exportar `DAY_LOG_REPOSITORY` y `DayLogService` (los consume la capa de Fase C/D).

#### B.7 `day-log.resolver.ts` (reescribir)
- Añadir **`@UseGuards(GqlAuthGuard)`** y **`@UseInterceptors(AuditInterceptor)`** (gap actual).
- Extraer `userId` desde `@Context()`. Usar `Types.ObjectId` en vez de `Int` para ids.
- Operaciones (mantener `dayLogFindAll`/`dayLogFindOne`):
  - `createDayLog(input)` → `DayLog`
  - `dayLogFindAll` / `dayLogFindOne(id)` → con ownership
  - `updateDayLog(input)`, `removeDayLog(id)`
  - `assignRoutineToDay(routineDayId, date)`, `updateDayStatus(date, isRest)`, `removeWorkoutSessionFromDay(workoutSessionId)`, `removeExtraSessionFromDay(date, extraSessionId)`
- Decoradores `@Audit(...)` en mutaciones (CREATE/UPDATE/DELETE/ASSIGN_DAY_LOG).

#### B.8 DTOs / Entity reales
Reemplazar `exampleField` en `create-day-log.input.ts`, `update-day-log.input.ts`, `entities/day-log.entity.ts`.

#### B.9 Tests
- Specs: service, resolver, validator, use cases (patrones de mock del week-log).
- E2E (`test/e2e/day-log/`): auth+ownership, creación con WS/ES, exclusividad interna, CRUD.
- Cierre de Fase B: suite completa verde (`npm test` + `npm run test:e2e`).

**Criterio de aceptación:** day-log funcional, con auth y auditoría; las WS/ES se crean/actualizan/eliminan igual que en week-log.

---

### FASE C — Unicidad del activo (regla dura de escritura)

1. **Servicio de coordinación** `ActiveTrackingService` (mismo servicio que expondrá la Fase D): inyecta `WEEK_LOG_REPOSITORY` + `DAY_LOG_REPOSITORY` y expone `hasActiveWeek(userId)`, `hasActiveDay(userId)`, `hasActiveTracking(userId)`.
2. Inyectarlo en:
   - `WeekLogValidator.validateCreation` → al crear semana, si hay **día activo** → `ConflictException('Already active day-log')`.
   - `DayLogValidator.validateCreation` → al crear día, si hay **semana activa** → `ConflictException('Already active week-log')`.
3. Respetar el patrón existente: completar un registro fuerza `active=false` (como `updateWeekLog` con `completed===true`).
4. Evitar acoplamiento directo week↔day: la coordinación vive en el servicio compartido (inyectado por token en ambos módulos), sin `forwardRef` circular entre week-log y day-log.

**Criterio de aceptación:** no se puede tener semana y día activos simultáneamente; crear el segundo lanza `ConflictException`.

---

### FASE D — Capa de lectura unificada `activeTracking`

1. Definir `TrackingType` enum + `ActiveTracking` `ObjectType` (ver contrato en §3).
2. Exponer `@Query activeTracking` en un resolver de la capa (p. ej. `active-tracking`).
3. `ActiveTrackingService` consulta `findActive` en ambos repos y arma el DTO (`hasActive`, `type`, `week?`, `day?`).
4. **Transición**: `activeWeekLog`/`currentWorkoutSession` se mantienen **deprecados** (no se eliminan en esta iteración); el front migra a `activeTracking`.
5. Auditoría/guard: aplicar el patrón del resto de tracking (`GqlAuthGuard`).

**Criterio de aceptación:** `activeTracking` devuelve el activo (WEEK_LOG o DAY_LOG) o `hasActive=false`; reemplaza a `activeWeekLog` para el front.

---

## 7. Consideraciones técnicas / riesgos

- **Guard faltante hoy**: el resolver day-log actual no está protegido y devuelve strings → añadir `GqlAuthGuard` + tipos reales (Fase B).
- **`WEKK` typo**: normalizar requiere migrar docs que ya tienen `'Week-log'` por defecto (ver §4).
- **Colisiones GraphQL**: respetar la convención `<entidad><Verbo>`; no introducir nombres duplicados. `activeTracking` no colisiona con `activeWeekLog` (ambos existirán durante la transición).
- **Auditoría**: `@Audit` en todas las mutaciones de day-log.
- **forwardRef**: week-log ↔ WorkoutSession ya usa `forwardRef`; day-log replica ese patrón. La Fase C/D inyecta ambos repos en `ActiveTrackingService` sin crear ciclo week↔day.
- **Tests**: replicar patrones (unit + e2e). Cobertura al cierre de cada fase.

---

## 8. Fuera de alcance

- Frontend (otro repo): no se toca desde este plan, pero se documenta el cambio de API (campo `distributionDays`, operaciones day-log, query `activeTracking`) para sincronizar.
- `syncWeekLogDays`: sin equivalente en day-log (un día = una sesión).
- Eliminación definitiva de `activeWeekLog`/`currentWorkoutSession` → iteración posterior.
- Migración del campo a `training-preference`: descartada (se activa `distributionDays` en user-profile).

---

## 9. Documentos de referencia

- `src/modules/routines/tracking/week-log/` — arquitectura de referencia (domain/repository/use-cases/validator/service/module).
- `src/modules/user/user-profile/README.md` — bounded-contexts.
- `documents/config/testing.md` — patrones de mocks y e2e.
- `AGENTS.md` §14 — estado actual del day-log (a actualizar al cierre).
