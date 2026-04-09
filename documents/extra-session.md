# Extra Session - Documentación Técnica

## 1. Propósito

El módulo **ExtraSession** permite registrar actividades físicas adicionales fuera del plan de entrenamiento principal. Las sesiones se crean a través de **WeekLog** (`updateWeekLogExtraSession`), donde se crea automáticamente una WorkoutSession si no existe, y se vincula bidireccionalmente.

---

## 2. Arquitectura General

### Flujo de Datos (Backend)

```
WeekLogResolver.updateWeekLogExtraSession()
        ↓
WeekLogService.updateWithExtraSession()
        │
        ├── 1. WorkoutSessionService.create() → Nueva WS (si no existe)
        │         ↓
        │    Se vincula a WeekLogDay.workoutSessionId
        │
        └── 2. ExtraSessionService.create() → Nueva ES
                  ↓
             Se vincula a WS via workoutSessionId
        │
        └── 3. WeekLog.days[].extraSessionIds.push(ES._id)
```

**Ubicación**: `src/modules/routines/tracking/extra-session/`

---

## 3. Catálogo de Disciplinas

El catálogo define las actividades físicas disponibles con su **MET** (Metabolic Equivalent of Task) para calcular calorías.

### Categorías

```typescript
enum ExtraSessionCategory {
  CARDIO = 'cardio',
  STRENGTH = 'strength',
  SPORT = 'sport',
  MIND_BODY = 'mind_body',
}
```

### Disciplinas por Categoría

| Clave | Label | Categoría | MET |
|-------|-------|-----------|-----|
| `running` | Running | CARDIO | 8.0 |
| `cycling` | Ciclismo | CARDIO | 7.5 |
| `stationary_bike` | Bicicleta fija | CARDIO | 7.0 |
| `swimming` | Natación | CARDIO | 8.0 |
| `walking` | Caminata | CARDIO | 3.5 |
| `weightlifting` | Levantamiento de pesas | STRENGTH | 5.0 |
| `crossfit` | CrossFit | STRENGTH | 9.0 |
| `football` | Fútbol | SPORT | 8.0 |
| `basketball` | Básquet | SPORT | 7.5 |
| `tennis` | Tenis | SPORT | 7.0 |
| `yoga` | Yoga | MIND_BODY | 3.0 |
| `pilates` | Pilates | MIND_BODY | 3.5 |
| `mobility` | Movilidad / Stretching | MIND_BODY | 2.5 |

---

## 4. Modelo de Datos

### Schema MongoDB - ExtraSession

```typescript
@Schema({ timestamps: true })
export class ExtraSession {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'WorkoutSession', required: true, index: true })
  workoutSessionId: Types.ObjectId;  // ← Vinculación a WorkoutSession

  @Prop({ type: String, required: true, enum: Object.values(ExtraSessionCategory) })
  category: ExtraSessionCategory;

  @Prop({ type: String, required: true, enum: [...] })
  discipline: ExtraSessionDisciplineKey;

  @Prop({ type: Date, required: true, index: true })
  date: Date;

  @Prop({ type: Number, required: true, min: 1 }) // minutos
  duration: number;

  @Prop({ type: Number, required: true, min: 1, max: 5 }) // 1-5
  intensityLevel: number;

  @Prop({ type: Number, default: null }) // override manual
  calories?: number;

  @Prop({ type: String, default: '' })
  notes?: string;
}
```

### Schema MongoDB - WeekLog (fragmento relevante)

```typescript
@Schema({ _id: false })
class WeekLogDay {
  @Prop({ required: true })
  order: number; // 1–7

  @Prop({ required: true })
  date: Date;

  @Prop({ type: Types.ObjectId, ref: 'WorkoutSession', default: null })
  workoutSessionId?: Types.ObjectId | null;  // ← Referencia a WorkoutSession

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'ExtraSession' }],
    default: [],
  })
  extraSessionIds: Types.ObjectId[];  // ← Array de ExtraSessions
}

@Schema({ timestamps: true })
export class WeekLog {
  @Prop({ type: [WeekLogDaySchema] })
  days: WeekLogDay[];
}
```

### Índices MongoDB

```typescript
ExtraSessionSchema.index({ userId: 1, date: 1 });
ExtraSessionSchema.index({ workoutSessionId: 1 });
ExtraSessionSchema.index({ discipline: 1 });

WeekLogSchema.index({ userId: 1, startDate: 1 });
WeekLogSchema.index({ 'days.workoutSessionId': 1 });
WeekLogSchema.index({ 'days.extraSessionIds': 1 });
```

---

## 5. Mutations GraphQL

### Mutation Principal: updateWeekLogExtraSession

```graphql
mutation updateWeekLogExtraSession($input: UpdateWeekLogExtraSessionInput!) {
  updateWeekLogExtraSession(updateWeekLogInput: $input) {
    id
    days {
      order
      workoutSessionId
      extraSessionIds
    }
  }
}
```

### Input: UpdateWeekLogExtraSessionInput

```graphql
input UpdateWeekLogExtraSessionInput {
  id: String!                    # WeekLog ID
  days: [UpdateWeekLogDayExtraSessionInput!]!  # Días a actualizar
}
```

### Input: UpdateWeekLogDayExtraSessionInput

```graphql
input UpdateWeekLogDayExtraSessionInput {
  order: Int!                    # Día del 1-7
  extraSession: CreateExtraSessionWithoutWsInput!  # Datos de la sesión
}
```

### Input: CreateExtraSessionWithoutWsInput

```graphql
input CreateExtraSessionWithoutWsInput {
  date: String!                  # ISO date string
  discipline: String!            # Clave de disciplina (ej: "running")
  duration: Int!                 # Minutos (min: 1)
  intensityLevel: Int!           # 1-5
  calories: Int                 # Opcional, override de calorías
  notes: String                  # Opcional
}
```

---

## 6. Flujo de Trabajo (createExtraSession via WeekLog)

### Paso a Paso

```
1. Frontend envía mutation updateWeekLogExtraSession con:
   - WeekLog ID
   - Array de días con extraSession a crear

2. WeekLogResolver.updateWeekLogExtraSession()
   - Extrae userId del contexto
   - Valida que el WeekLog pertenezca al usuario

3. WeekLogService.updateWithExtraSession(id, input, userId)
   a) Por cada día en input.days:
      
      - Busca el día en el WeekLog por 'order'
      
      - Si day.workoutSessionId NO existe:
        → Crea nueva WorkoutSession
        → Asigna day.workoutSessionId = newWsId
        → Marca day.isRest = true
        
      - Crea ExtraSession vinculada a la WS:
        → extraSessionService.create({
            ...input.extraSession,
            workoutSessionId: targetWsId.toString()
          }, userId)
          
      - Agrega ID al array del día:
        → day.extraSessionIds.push(extraSession._id)
        
   b) Guarda WeekLog actualizado

4. Retorna WeekLog con las nuevas relaciones
```

### Ejemplo de Payload

```json
{
  "updateWeekLogInput": {
    "id": "675f3c8b1234567890abcdef",
    "days": [
      {
        "order": 3,
        "extraSession": {
          "date": "2026-04-09T10:00:00.000Z",
          "discipline": "running",
          "duration": 30,
          "intensityLevel": 3,
          "calories": 280
        }
      }
    ]
  }
}
```

---

## 7. Fórmula de Cálculo de Calorías

El cálculo de calorías se basa en la fórmula estándar MET (Metabolic Equivalent of Task):

```
calorías = MET × peso(kg) × (duración(min) / 60) × factor_intensidad
```

### Parámetros

| Parámetro | Valor | Descripción |
|-----------|-------|-------------|
| **MET** | Del catálogo | Valor MET de la disciplina |
| **peso** | 70 kg (constante) | Peso corporal estimado |
| **duración** | Input del usuario | Duración en minutos |
| **factor_intensidad** | `1 + (intensityLevel - 3) × 0.15` | Ajuste por nivel de intensidad (1-5) |

### Validación en Backend

El backend permite un **override manual** de calorías si la diferencia con el valor calculado no supera las **400 kcal**. De lo contrario, usa el valor calculado.

---

## 8. Relaciones Finales

```
┌─────────────────────────────────────────────────────────────┐
│                         WeekLog                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  days: [                                            │   │
│  │    {                                                │   │
│  │      order: 1,                                      │   │
│  │      workoutSessionId: "ws-123" ─────────────────┐ │   │
│  │      extraSessionIds: ["es-1", "es-2"]           │ │   │
│  │    }                                               │   │
│  │  ]                                                 │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
              │                              │
              │ workoutSessionId             │ extraSessionIds
              ▼                              ▼
┌─────────────────────────┐    ┌─────────────────────────────────┐
│    WorkoutSession      │    │       ExtraSession               │
│  - _id: "ws-123"       │    │  - _id: "es-1"                  │
│  - weekLogId: "wl-456" │    │  - workoutSessionId: "ws-123"   │
│  - date: ...           │    │  - discipline: "running"         │
│  - exercises: []       │    │  - duration: 30                 │
└─────────────────────────┘    │  - calories: 280                │
                               │  - ...                          │
                               └─────────────────────────────────┘
```

### Bidireccionalidad

| Campo | Desde | Hacia |
|-------|-------|-------|
| `WorkoutSession._id` | ExtraSession.workoutSessionId | WeekLogDay.workoutSessionId |
| `ExtraSession._id` | WeekLogDay.extraSessionIds[] | ExtraSession._id |

---

## 9. Protección y Auditoría

### Autenticación
- Mutation requiere `GqlAuthGuard`
- El userId se extrae del contexto de la request

### Auditoría
- Las mutaciones de ExtraSession tienen el decorador `@Audit`:
  - `CREATE_EXTRA_SESSION`
  - `UPDATE_EXTRA_SESSION`
  - `REMOVE_EXTRA_SESSION`

---

## 10. Archivos del Módulo

### ExtraSession

| Archivo | Descripción |
|---------|-------------|
| `extra-session.resolver.ts` | Queries y Mutations GraphQL |
| `extra-session.service.ts` | Lógica de negocio |
| `extra-session.schema.ts` | Modelo Mongoose |
| `extra-session.catalog.ts` | Catálogo de disciplinas con MET |
| `extra-session.entity.ts` | Entidad GraphQL |
| `dto/create-extra-session.input.ts` | Input para creación directa |
| `dto/update-extra-session.input.ts` | Input para actualización |

### WeekLog (relacionado)

| Archivo | Descripción |
|---------|-------------|
| `week-log.resolver.ts` | Mutation updateWeekLogExtraSession |
| `week-log.service.ts` | Método updateWithExtraSession |
| `presentation/dto/update-week-log.input.ts` | Inputs GraphQL |
| `infrastructure/schemas/week-log.schema.ts` | Schema con extraSessionIds |

---

## 11. Referencias TypeScript

Ver archivo: `documents/interfaces/extra-session.types.ts`