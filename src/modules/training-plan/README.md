# Training Plan Module

## Mutations

### `generatePlan`

Genera un plan de entrenamiento personalizado usando IA. No recibe argumentos; obtiene el userId del JWT.

**Qué hace:**

1. Valida que el usuario tenga perfil completo (UserProfile) — si falta algo, lanza `BadRequestException` con el campo faltante.
2. Construye el contexto del usuario (datos del perfil, historial, etc.).
3. Crea un `Goal` con ese contexto como snapshot.
4. Envía el contexto a la IA (Groq por defecto) con un prompt diseñado para generar un plan.
5. Parsea la respuesta de la IA y extrae: título, foco, duración, días por semana.
6. Guarda el `TrainingPlan` en MongoDB con status `DRAFT` y el snapshot de la IA.
7. Devuelve el plan completo.

**Requisitos previos (si falla, 400):**

- `UserProfile` del usuario debe existir (nombre, edad, peso, nivel, objetivos, etc.)

**GraphQL:**

```graphql
mutation GeneratePlan {
  generatePlan {
    id
    title
    description
    focus
    status
    startDate
    endDate
    durationWeeks
    trainingDaysPerWeek
    overallAdherencePercent
    totalSessionsCompleted
    totalSessionsPlanned
    version
    tags
    createdAt
    updatedAt
    aiSnapshot {
      contextSentToAI
      promptUsed
      modelUsed
      rawResponse
      tokensUsed
      generatedAt
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
      title
      focus
      status
      startDate
      endDate
      durationWeeks
      trainingDaysPerWeek
      totalSessionsPlanned
      aiSnapshot {
        modelUsed
        tokensUsed
        generatedAt
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
    const plan = data?.generatePlan;
    console.log('Plan generado:', plan.id, plan.title);
  });
}
```

**Valores de retorno:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `ID` | ID del plan en MongoDB |
| `title` | `String` | Nombre del plan (ej: "Plan Hipertrofia – Junio 2025") |
| `description` | `String?` | Descripción opcional |
| `focus` | `PlanFocus` | Enum: `hypertrophy`, `strength`, `endurance`, `fat_loss`, `recomp`, `maintenance`, `sport_specific` |
| `status` | `PlanStatus` | `draft` (recién generado), `active`, `completed`, `abandoned`, `archived` |
| `startDate` | `DateTime` | Fecha de inicio (hora de generación) |
| `endDate` | `DateTime` | Fecha fin calculada (startDate + durationWeeks) |
| `durationWeeks` | `Int` | Semanas del plan (default: 4) |
| `trainingDaysPerWeek` | `Int` | Días de entreno por semana (default: 3) |
| `overallAdherencePercent` | `Float` | % de adherencia global (0–100, inicia en 0) |
| `totalSessionsCompleted` | `Int` | Sesiones completadas (inicia en 0) |
| `totalSessionsPlanned` | `Int` | Sesiones totales = durationWeeks × trainingDaysPerWeek |
| `replacedByPlanId` | `ID?` | Si se regenera, apunta al plan que lo reemplazó |
| `version` | `Int` | Versión del plan (inicia en 1) |
| `tags` | `[String]` | Etiquetas libres |
| `createdAt` | `DateTime` | Timestamp de creación |
| `updatedAt` | `DateTime` | Timestamp de última actualización |
| `aiSnapshot` | `AiSnapshot` | Snapshot de la llamada a IA (ver abajo) |

**`aiSnapshot`:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `contextSentToAI` | `JSONObject` | Contexto del usuario enviado a la IA |
| `promptUsed` | `String` | Prompt completo enviado |
| `modelUsed` | `String` | Modelo utilizado (ej: `llama3-70b-8192`) |
| `rawResponse` | `JSONObject` | Respuesta cruda de la IA |
| `tokensUsed` | `Int?` | Tokens consumidos |
| `generatedAt` | `DateTime` | Momento de la generación |

**Errores posibles:**

- `400 Bad Request` — Faltan datos en el UserProfile (campos faltantes en `missing`)
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
