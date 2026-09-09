# Módulo Stats (Métricas y Estadísticas)

> **⚠️ Módulo experimental.** Actualizado 2026-09-03. Tiene 32 archivos con arquitectura hexagonal, pero **no está activo en producción** y por decisión se mantiene **fuera de la suite de tests** (0% cobertura).

## 1. Propósito

El módulo `stats` calcula y expone métricas de entrenamiento de cada usuario, usando un **worker/Lambda externo** que se encarga del cómputo pesado. NestJS **nunca calcula las estadísticas**: solo publica el evento, ofrece los datos crudos al worker y guarda (upsert) los resultados ya calculados.

Métricas que gestiona:

| Métrica | Qué mide |
|---------|----------|
| **Top Exercises** | Ejercicios más usados por el usuario (top 5 por sesiones/volumen) |
| **Top Routines** | Planes de rutina más usados (top 5 por semanas/sesiones) |
| **Personal Records** | Mejores marcas por ejercicio (1RM estimado, mejor peso/volumen) |
| **Adherence** | Adherencia semanal (% de días completados vs. planificados) |

---

## 2. Arquitectura

Sigue el patrón hexagonal (Clean Architecture) del resto del proyecto:

```
Resolver → Service → Use Case → Domain (interface) ← Infrastructure (implementación)
```

| Capa | Directorio | Responsabilidad |
|------|------------|-----------------|
| **Presentation** | `presentation/` | Entidades GraphQL de salida (`*.output.ts`) y DTOs de entrada (`save-stats.input.ts`, `worker-raw-data.output.ts`) |
| **Application** | `application/use-cases/` | 9 casos de uso: 4 `get-*`, 4 `save-*`, 1 `get-raw-data-for-worker` |
| **Domain** | `domain/` | Entidades de dominio (`stats.domain.ts`) e interfaz `IStatsRepository` |
| **Infrastructure** | `infrastructure/` | Schemas Mongoose (9) y `StatsRepository` (implementación concreta) |

### Estructura de archivos

```
stats/
├── stats.module.ts                     # Módulo NestJS (registro de schemas + providers)
├── stats.resolver.ts                   # Queries/Mutations GraphQL y guards
├── stats.service.ts                    # Fachada que delega en los use cases
├── stats-event-publisher.ts            # Publica eventos a SQS
├── CONTRACT.md                         # ⚠️ Documento a actualizar (contrato API ↔ worker)
├── LAMBDA.md                           # ⚠️ Escrito para implementar el Lambda en Python
├── application/use-cases/              # Lógica de negocio (9 use cases)
├── domain/entities/                    # Entidades de dominio + interfaces de datos crudos
├── domain/interfaces/repositories/     # Interfaz IStatsRepository + token
├── infrastructure/repositories/        # StatsRepository (Mongoose)
├── infrastructure/schemas/             # Schemas Mongoose
└── presentation/dto/ + entities/       # Capa GraphQL
```

---

## 3. Arquitectura Interna (código)

### 3.1 `stats.module.ts`

- Importa `MongooseModule.forFeature` con los **9 schemas**:
  - 4 de salida (resultados): `UserTopExercise`, `UserTopRoutine`, `UserPersonalRecord`, `UserAdherence`
  - 5 de referencia (lectura de datos crudos): `WorkoutSession`, `WeekLog`, `Exercise`, `RoutinePlan`, `UserStrengthMetric`
- Registra `StatsResolver`, `StatsService`, `StatsEventPublisher`, los 9 use cases (`STAT_USE_CASES`) y el `StatsRepository` bajo el token `STATS_REPOSITORY`.
- Exporta `StatsService`.

### 3.2 `stats.resolver.ts` — Operaciones GraphQL

**Queries (GqlAuthGuard** — cookie JWT del usuario **):**

| Operación | Descripción |
|-----------|-------------|
| `getTopExercises` → `TopExerciseStats` | Top 5 ejercicios del usuario |
| `getTopRoutines` → `TopRoutineStats` | Top 5 rutinas del usuario |
| `getPersonalRecords` → `PersonalRecordStats` | Mejores marcas del usuario |
| `getAdherence` → `AdherenceStats` | Adherencia semanal del usuario |

**Query / Mutations (ServiceAuthGuard** — JWT de servicio `role: SERVICE`, scope `stats:read/write` **):**

| Operación | Descripción |
|-----------|-------------|
| `getRawDataForWorker(userId)` → `WorkerRawData` | Datos crudos para que el worker los procese |
| `saveTopExercises(userId, input)` | Worker guarda top ejercicios calculados |
| `saveTopRoutines(userId, input)` | Worker guarda top rutinas calculadas |
| `savePersonalRecords(userId, input)` | Worker guarda marcas calculadas |
| `saveAdherence(userId, input)` | Worker guarda adherencia calculada |

Todas las operaciones get de usuario obtienen `userId` del contexto (`extractUserId`), mientras que las de servicio reciben `userId` como argumento explícito (el worker lo extrae del mensaje SQS).

### 3.3 Capa de dominio

- **Entidades**: `TopExerciseEntryDomain`, `TopRoutineEntryDomain`, `PersonalRecordEntryDomain`, `AdherenceWeekDomain` y los contenedores `UserTopExerciseDomain`, `UserTopRoutineDomain`, `UserPersonalRecordDomain`, `UserAdherenceDomain`.
- **Interfaz** `IStatsRepository` (token `STATS_REPOSITORY`):
  - Lectura: `findTopExercisesByUser`, `findTopRoutinesByUser`, `findPersonalRecordsByUser`, `findAdherenceByUser`
  - Escritura: `upsertTopExercises`, `upsertTopRoutines`, `upsertPersonalRecords`, `upsertAdherence`
- **Tipos de datos crudos** (`RawWorkoutSessionData`, `RawWeekLogData`, `RawExerciseData`, `RawRoutinePlanData`, `RawStrengthMetricData`) agrupados en `WorkerRawDataDomain`.

### 3.4 Use cases

- **`save-*` (4):** Reciben los datos calculados + `computedAt`, construyen el objeto de dominio y delegan en el repositorio para hacer el **upsert** (1 doc por usuario y colección).
- **`get-*` (4):** Consultan el resultado almacenado para el usuario (o `null` si aún no existe).
- **`getRawDataForWorker` (1):** Consulta en paralelo las 5 colecciones de referencia y devuelve los datos crudos:
  - `WorkoutSession` con `status: 'complete'` y sin borrado lógico, ordenadas por fecha.
  - `WeekLog` sin borrado lógico (incluye sus 7 días, con `status`, `isRest`, `planId`).
  - Catálogo completo de `Exercise`.
  - `RoutinePlan` creados por el usuario (`createdBy: userId`).
  - `UserStrengthMetric` del usuario, ordenadas por `measuredAt`.

### 3.5 `StatsRepository` (infrastructure)

- Consulta cada modelo con `findOne({ userId })` y mapea el documento Mongoose a entidad de dominio.
- Escritura mediante `findOneAndUpdate({ userId }, {...}, { upsert: true, new: true, runValidators: true })`: **un documento por usuario y métrica** (índice único en `userId`).
- Convierte ObjectIds (`exerciseId`, `planId`) de/a strings.

### 3.6 Schemas Mongoose

**Schemas de resultado** (1 documento por usuario, `userId` único):

| Schema | Contenido por entrada |
|--------|-----------------------|
| `UserTopExercise` | `rank`, `exerciseId`, `name`, `category`, `totalSessions`, `totalVolume`, `avgVolumePerSession` |
| `UserTopRoutine` | `rank`, `planId`, `name`, `totalWeeks`, `totalSessions`, `adherenceRate` |
| `UserPersonalRecord` | `exerciseId`, `exerciseName`, `category`, `oneRmEstimated`, `bestWeight`, `bestReps`, `bestVolume`, `achievedAt`, `previousOneRm` |
| `UserAdherence` | `weekStartDate`, `totalDays`, `completedDays`, `skippedDays`, `pendingDays`, `adherencePercent` |

Todos tienen `userId` (único), `computedAt` y `timestamps`.

**Schemas de referencia** (definidos localmente con nombre "reference" para leer colecciones ya existentes): `WorkoutSession`, `WeekLog`, `Exercise`, `RoutinePlan`, `UserStrengthMetric`. Se usan solo en `getRawDataForWorker` y en el mecanismo de disparo.

---

## 4. Eventos y disparo (SQS)

`StatsEventPublisher` escucha eventos del `EventEmitter` de Nest:

| Evento | Emisor | Cuándo |
|--------|--------|--------|
| `workout-session.saved` | WorkoutSession | Al guardar una sesión de entrenamiento |
| `week-log.finalized` | WeekLog | Al finalizar/sellar una semana |

Si `STATS_SQS_QUEUE_URL` está configurado, publica el mensaje a SQS:

```json
{
  "userId": "507f1f77bcf86cd799439011",
  "triggerType": "WORKOUT_SESSION | WEEK_LOG_FINALIZED",
  "entityId": "507f1f77bcf86cd799439012",
  "timestamp": "2026-08-19T14:30:00.000Z"
}
```

> Si la URL de SQS **no** está configurada, el publisher se inicia pero **omite silenciosamente** el envío (los eventos siguen disparándose internamente). Esto permite que el módulo nunca bloquee el flujo principal de tracking.

---

## 5. Flujo de datos completo

```
1. Usuario guarda WorkoutSession / finaliza WeekLog
2. Resolver emite el evento (workout-session.saved / week-log.finalized)
3. StatsEventPublisher → publica a SQS
4. Worker recoge el mensaje SQS
5. Worker llama getRawDataForWorker(userId) → obtiene datos crudos
6. Lambda (Python) calcula las 4 métricas
7. Worker llama saveTopExercises / saveTopRoutines / savePersonalRecords / saveAdherence
8. NestJS hace upsert (1 documento por usuario por colección)
9. Frontend consulta con getTopExercises / getTopRoutines / getPersonalRecords / getAdherence
```

---

## 6. Autenticación

| Guard | Tipo de token | Uso |
|-------|---------------|-----|
| `GqlAuthGuard` | JWT de usuario (cookie HttpOnly `token`) | Queries de lectura para el frontend |
| `ServiceAuthGuard` | JWT de servicio (`role: SERVICE`, scopes `stats:read` / `stats:write`) | `getRawDataForWorker`, `saveTopExercises`, `saveTopRoutines`, `savePersonalRecords`, `saveAdherence` |

---

## 7. Variables de Entorno

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `JWT_SECRET` | Sí | Secret compartido para firmar JWT de usuario y de servicio |
| `STATS_SQS_QUEUE_URL` | No | URL de la cola SQS. Si no se define, se desactiva la publicación |
| `AWS_REGION` | No | Región AWS para el cliente SQS. Default: `us-east-1` |
| `AWS_ACCESS_KEY_ID` | Fuera de AWS | Credenciales IAM para SQS (no necesarias si se usa rol IAM en EC2/ECS) |
| `AWS_SECRET_ACCESS_KEY` | Fuera de AWS | Credenciales IAM para SQS |

---

## 8. Estado / Roadmap

- **Registrado** en `app.module.ts`.
- **Implementado**: resolver completo, 9 use cases, repositorio, 9 schemas, publisher SQS.
- **Sin activar** en producción.
- **Fuera de la suite de tests** (0% cobertura — experimental, prioridad baja).
- Los documentos `CONTRACT.md` y `LAMBDA.md` describen el contrato API↔worker y cómo implementar el Lambda (Python) y pueden quedar obsoletos frente a este código.

> Si el módulo se activa a futuro, empezar por los use cases puros (`save-*`, `get-raw-data-for-worker`) según `documents/reports/cobertura-tests-2026-08-21.md`.
