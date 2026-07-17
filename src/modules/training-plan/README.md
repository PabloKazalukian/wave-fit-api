# Training Plan Module

## Mutations

### `generatePlan`

Genera un plan de entrenamiento personalizado usando IA y devuelve un **WeekLog simulado** (sin persistir) con WorkoutSessions que referencian exercises reales del catálogo. No recibe argumentos; obtiene el userId del JWT.

**Qué hace:**

1. Valida que el usuario tenga perfil completo (UserProfile) — si falta algo, lanza `BadRequestException` con el campo faltante.
2. Construye el contexto del usuario (datos del perfil, historial, etc.).
3. Crea un `Goal` con ese contexto como snapshot (para auditoría).
4. Obtiene el catálogo completo de exercises (`ExerciseService.findAll()`).
5. Envía el contexto + exercises a la IA (Groq por defecto) con un prompt que incluye la lista de exercises disponibles (id, name, category).
6. La IA responde con una semana completa (7 días) usando **IDs reales** del catálogo.
7. Parsea y valida la respuesta: exactamente 7 días, exerciseIds válidos.
8. Construye un `WeekLogDomain` en memoria con WorkoutSessions para cada día de entrenamiento.
9. Devuelve el WeekLog simulado al cliente (sin persistir en MongoDB).

**Flujo del cliente:**

```
generatePlan → WeekLog simulado → cliente modifica si quiere → savePlan (futuro)
```

**Requisitos previos (si falla, 400):**

- `UserProfile` del usuario debe existir (nombre, edad, peso, nivel, objetivos, etc.)

**GraphQL:**

```graphql
mutation GeneratePlan {
  generatePlan {
    id
    userId
    startDate
    endDate
    planId
    completed
    active
    days {
      order
      date
      isRest
      workoutSessionId
      exercises {
        exerciseId
        series
        sets {
          reps
          weights
        }
        notes
      }
      extraSessionIds
      status
    }
  }
}
```

**Apollo Angular:**

```typescript
// generate-plan.mutation.ts
import { gql } from 'apollo-angular';

export const GENERATE_PLAN = gql`
  mutation GeneratePlan {
    generatePlan {
      id
      userId
      startDate
      endDate
      completed
      active
      days {
        order
        date
        isRest
        workoutSessionId
        exercises {
          exerciseId
          series
          sets {
            reps
            weights
          }
        }
        status
      }
    }
  }
`;
```

```typescript
// componente.service.ts o componente.ts
import { GENERATE_PLAN } from './generate-plan.mutation';

constructor(private apollo: Apollo) {}

generatePlan() {
  return this.apollo.mutate({
    mutation: GENERATE_PLAN,
  }).subscribe(({ data }) => {
    const weekLog = data?.generatePlan;
    console.log('WeekLog generado:', weekLog.id);
    console.log('Días:', weekLog.days.length);
  });
}
```

**Valores de retorno (WeekLog):**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `ID` | ID temporal del WeekLog (random hex, se reemplaza al persistir) |
| `userId` | `ID` | ID del usuario |
| `startDate` | `DateTime` | Fecha de inicio (hoy en UTC) |
| `endDate` | `DateTime` | Fecha fin (startDate + 6 días) |
| `planId` | `ID?` | `null` (no hay RoutinePlan asociado) |
| `completed` | `Boolean` | `false` (recién generado) |
| `active` | `Boolean` | `true` |
| `days` | `[WeekLogDay]` | 7 días de la semana |

**`days[]` (WeekLogDay):**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `order` | `Int` | Posición del día (1–7) |
| `date` | `DateTime` | Fecha UTC del día |
| `isRest` | `Boolean` | Si es día de descanso |
| `workoutSessionId` | `ID?` | ID temporal de la WorkoutSession asociada (null si es rest) |
| `exercises` | `[ExercisePerformance]` | Ejercicios planeados (solo días de entrenamiento) |
| `extraSessionIds` | `[ID]` | `[]` (sin sesiones extras) |
| `status` | `String` | `'pending'` |

**`exercises[]` (ExercisePerformance):**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `exerciseId` | `ID` | ID real del catálogo de exercises |
| `series` | `Int` | `0` (el usuario completa) |
| `sets` | `[SetPerformance]` | `[]` (el usuario completa) |
| `notes` | `String?` | Notas de la IA (opcional) |

**Errores posibles:**

- `400 Bad Request` — Faltan datos en el UserProfile (campos faltantes en `missing`)
- `400 Bad Request` — La IA devolvió una estructura inválida (menos de 7 días, exerciseId faltante)
- `404 Not Found` — UserProfile no encontrado

---

## Queries

### `trainingPlans`

Devuelve todos los planes del usuario autenticado, ordenados por `createdAt` descendente.

```graphql
query GetTrainingPlans {
  trainingPlans {
    id
    title
    focus
    status
    durationWeeks
    trainingDaysPerWeek
    createdAt
  }
}
```

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
  ├─ ExerciseService.findAll()        → catálogo de exercises
  ├─ UserProfileService               → contexto del usuario
  ├─ buildPlanPrompts(ctx, exercises)  → systemPrompt + userPrompt
  │    ├─ systemPrompt: rol + estructura JSON esperada (days[])
  │    └─ userPrompt: datos usuario + consideraciones + catálogo exercises
  ├─ AiService.executePrompt()         → rawContent (JSON)
  ├─ PlanGeneratorParser.parse()       → ParsedPlan { days: ParsedDay[] }
  │    ├─ validate(): 7 días, order/isRest/exerciseId
  │    └─ normalize(): estructura tipada
  └─ buildWeekLogFromPlan()            → WeekLogDomain + WorkoutSessionCreationData[]
       ├─ startDate = hoy (LocalDate)
       ├─ endDate = hoy + 6 días
       ├─ days[0-6]: WeekLogDayDomain con dates UTC
       └─ sessions: WorkoutSessionCreationData para días no-rest
```

**Nota:** El WeekLog y las WorkoutSessions se construyen en memoria con IDs temporales (random hex). No se persisten hasta que el cliente llame a la mutación `savePlan` (futuro).
