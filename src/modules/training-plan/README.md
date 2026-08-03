# Training Plan Module

## Mutations

### `generatePlan`

Genera un plan de entrenamiento personalizado usando IA, lo **persiste** en MongoDB como `TrainingPlan` con `confirmed: false`, y lo devuelve. No recibe argumentos; obtiene el userId del JWT.

**Qué hace:**

1. Valida que el usuario tenga perfil completo (UserProfile) — si falta algo, lanza `BadRequestException` con el campo faltante.
2. Construye el contexto del usuario (datos del perfil, historial, etc.).
3. Crea un `Goal` con ese contexto como snapshot (para auditoría).
4. Obtiene el catálogo completo de exercises (`ExerciseService.findAll()`).
5. Envía el contexto + exercises a la IA (Groq por defecto) con un prompt que incluye la lista de exercises disponibles (id, name, category).
6. La IA responde con una semana completa (7 días) usando **IDs reales** del catálogo.
7. Parsea y valida la respuesta: exactamente 7 días, exerciseIds válidos. `durationWeeks` mínimo 1.
8. Construye un `WeekLogDomain` en memoria con WorkoutSessions para cada día de entrenamiento.
9. **Persiste** un `TrainingPlan` en MongoDB con status DRAFT y `confirmed: false`.
10. Devuelve el `TrainingPlan` al cliente.

**Flujo del cliente:**

```
generatePlan → TrainingPlan (confirmed: false) → cliente revisa → confirmPlan(id)
```

**Requisitos previos (si falla, 400):**

- `UserProfile` del usuario debe existir (nombre, edad, peso, nivel, objetivos, etc.)

**GraphQL:**

```graphql
mutation GeneratePlan {
  generatePlan {
    id
    userId
    userProfileId
    goalId
    title
    description
    focus
    status
    startDate
    endDate
    durationWeeks
    trainingDaysPerWeek
    confirmed
    aiSnapshot {
      modelUsed
      tokensUsed
      generatedAt
    }
    overallAdherencePercent
    totalSessionsCompleted
    totalSessionsPlanned
    version
    tags
    createdAt
    updatedAt
  }
}
```

**Valores de retorno (TrainingPlan):**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `ID` | ID del TrainingPlan persistido |
| `userId` | `ID` | ID del usuario |
| `userProfileId` | `ID` | ID del perfil de usuario usado para generar |
| `goalId` | `ID` | ID del snapshot de Goal (auditoría) |
| `title` | `String` | Nombre del plan (generado por la IA) |
| `description` | `String?` | Descripción opcional |
| `focus` | `PlanFocus` | `fat_loss`, `muscle_gain`, `strength`, `endurance`, `maintenance`, `recomp` |
| `status` | `PlanStatus` | `draft` (al generar) |
| `startDate` | `DateTime` | Fecha de inicio (hoy en UTC) |
| `endDate` | `DateTime` | Fecha fin (startDate + durationWeeks * 7 días) |
| `durationWeeks` | `Int` | Duración en semanas (mínimo 1, definido por la IA) |
| `trainingDaysPerWeek` | `Int` | Días de entrenamiento por semana |
| `confirmed` | `Boolean` | `false` (recién generado, pendiente de confirmación) |
| `aiSnapshot` | `AiSnapshot` | Contexto enviado, prompt, modelo, respuesta cruda, tokens |
| `overallAdherencePercent` | `Float` | `0` (sin datos de progreso) |
| `totalSessionsCompleted` | `Int` | `0` |
| `totalSessionsPlanned` | `Int` | `0` |
| `version` | `Int` | `1` |
| `tags` | `[String]` | `[]` |
| `createdAt` | `DateTime` | Fecha de creación |
| `updatedAt` | `DateTime` | Fecha de última actualización |

**Errores posibles:**

- `400 Bad Request` — Faltan datos en el UserProfile (campos faltantes en `missing`)
- `400 Bad Request` — La IA devolvió una estructura inválida (menos de 7 días, exerciseId faltante)
- `404 Not Found` — UserProfile no encontrado

---

### `confirmPlan(id: String)`

Confirma un plan generado previamente, cambiando `confirmed` de `false` a `true`. Recibe el ID del TrainingPlan; el userId se obtiene del JWT.

**Qué hace:**

1. Busca el `TrainingPlan` por `_id` y `userId` (scope por usuario).
2. Si no existe, lanza `NotFoundException`.
3. Setea `confirmed: true`.
4. Devuelve el `TrainingPlan` actualizado.

**Flujo del cliente:**

```
generatePlan → TrainingPlan (confirmed: false) → confirmPlan(id) → TrainingPlan (confirmed: true)
```

**GraphQL:**

```graphql
mutation ConfirmPlan($id: String!) {
  confirmPlan(id: $id) {
    id
    title
    confirmed
    status
    updatedAt
  }
}
```

**Errores posibles:**

- `404 Not Found` — TrainingPlan no encontrado (ID inválido o no pertenece al usuario)

---

## Queries

### `trainingPlans`

Devuelve los planes del usuario autenticado con **paginación numerada** (offset/limit), ordenados por `createdAt` descendente.

| Argumento | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `limit` | `Int` | `5` | Cantidad de planes por página |
| `offset` | `Int` | `0` | Desplazamiento (`(page - 1) * limit`) |

Retorna un objeto `TrainingPlanPage`: `items[]`, `total`, `limit`, `offset`, `totalPages`.

```graphql
query GetTrainingPlans($limit: Int!, $offset: Int!) {
  trainingPlans(limit: $limit, offset: $offset) {
    items {
      id
      title
      focus
      status
      confirmed
      durationWeeks
      trainingDaysPerWeek
      createdAt
    }
    total
    limit
    offset
    totalPages
  }
}
```

**Cálculo de páginas:** `page 1 → offset 0`, `page 2 → offset = limit`, `page N → offset = (N - 1) * limit`. Total de páginas: `totalPages = Math.ceil(total / limit)`.

### `trainingPlan(id: String)`

Devuelve un plan específico por ID.

```graphql
query GetTrainingPlan($id: String!) {
  trainingPlan(id: $id) {
    id
    title
    description
    focus
    status
    confirmed
    startDate
    endDate
    durationWeeks
    trainingDaysPerWeek
    tags
    aiSnapshot {
      modelUsed
      tokensUsed
    }
  }
}
```

---

## Otras Mutations

```graphql
mutation CreateTrainingPlan($input: CreateTrainingPlanInput!) {
  createTrainingPlan(createTrainingPlanInput: $input) {
    id
    title
  }
}

mutation UpdateTrainingPlan($input: UpdateTrainingPlanInput!) {
  updateTrainingPlan(updateTrainingPlanInput: $input) {
    id
    title
  }
}

mutation RemoveTrainingPlan($id: String!) {
  removeTrainingPlan(id: $id) {
    id
  }
}
```

---

## Arquitectura del Plan Generator

```
PlanGeneratorService
  ├─ PlanValidatorService.validate()    → valida perfil completo
  ├─ ExerciseService.findAll()          → catálogo de exercises
  ├─ UserProfileService                 → contexto del usuario
  ├─ Goal model.create()                → snapshot de auditoría
  ├─ buildPlanPrompts(ctx, exercises)   → systemPrompt + userPrompt
  │    ├─ systemPrompt: rol + estructura JSON esperada (days[])
  │    └─ userPrompt: datos usuario + consideraciones + catálogo exercises
  ├─ AiService.executePrompt()          → rawContent (JSON)
  ├─ PlanGeneratorParser.parse()        → ParsedPlan { days: ParsedDay[] }
  │    ├─ validate(): 7 días, order/isRest/exerciseId
  │    └─ normalize(): estructura tipada (durationWeeks min 1)
  └─ buildWeekLogFromPlan()             → WeekLogDomain + WorkoutSessionCreationData[]
       ├─ startDate = hoy (LocalDate)
       ├─ endDate = hoy + 6 días
       ├─ days[0-6]: WeekLogDayDomain con dates UTC
       └─ sessions: WorkoutSessionCreationData para días no-rest

TrainingPlanService.generate()
  ├─ PlanGeneratorService.generatePlan() → result (goalId, userProfileId, aiSnapshot, weekLog, metadata)
  └─ trainingPlanModel.create()          → TrainingPlan persistido (confirmed: false)
```

**Nota:** El WeekLog y las WorkoutSessions se construyen en memoria dentro del PlanGeneratorService. Se persisten como parte del TrainingPlan. La confirmación del plan (`confirmPlan`) es el paso siguiente para activarlo.
