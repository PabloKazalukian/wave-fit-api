# AI Module — Generación de Planes de Entrenamiento

## Contexto

Este módulo expone el servicio `AiService` con el patrón **Provider** (LangChain). Actualmente solo existe el provider **Groq** (`llama-3.3-70b-versatile`). La conexión con `training-plan` ya está armada a nivel de módulo; falta implementar la lógica de generación con IA y la creación posterior de WeekLogs.

---

## Diagnóstico Actual (Junio 2026)

| Componente | Estado |
|---|---|
| `AiService.executePrompt()` | ✅ Funciona con Groq |
| `GroqProvider` | ✅ Configurado con `.env` |
| `PlanGeneratorService.generatePlan()` | ⚠️ Parcial (sin validación ni WeekLogs) |
| `TrainingPlan Schema` (MongoDB) | ✅ Completo |
| `TrainingPlan` Entity/DTOs (GraphQL) | ❌ Placeholders |
| `plan-generator.prompt.ts` | ❌ Vacío (0 bytes) |
| `plan-generator..parser.ts` | ❌ Vacío + typo en nombre |
| `UserProfileService.getFullProfileContext()` | ✅ Trae todos los 8 sub-schemas |
| `buildUserContextForAI()` | ✅ Transforma datos para IA |
| `WeekLog` (hexagonal completo) | ✅ Usable desde otros módulos |

### Gaps

1. `PlanGeneratorService` usa `getFullLlmContext()` (5/8 sub-documentos) en vez de `getFullProfileContext()` (8/8)
2. No hay validación de campos mínimos requeridos
3. No hay prompt real (archivos vacíos)
4. No se crean WeekLogs tras generar el plan
5. Resolver/Service/DTOs son placeholders

---

## Campos Mínimos Requeridos

### Mínimo indispensable

Sin estos datos no se puede generar un plan personalizado:

| Esquema | Campos | Razón |
|---|---|---|
| `UserProfile` | `sex`, `birthDate`, `heightCm`, `weightKg` | Biometría base (edad, IMC, BMR) |
| `UserGoal` | `primaryGoal`, `trainingExperience`, `timelineWeeks` | Objetivo, experiencia y duración |
| `UserSchedule` | `daysPerWeek`, `sessionDurationMin` | Frecuencia y disponibilidad |
| `UserHealthConstraint` | (existencia del documento) | Lesiones/restricciones activas |

### Altamente recomendado (opcional pero valioso)

| Esquema | Campos |
|---|---|
| `UserResource` | `equipment`, `trainingEnvironments` |
| `UserTrainingPreference` | `preferredStyles`, `intensityPreference`, `dislikedExercises` |
| `UserStrengthMetric` | Al menos 1 registro (press banca, sentadilla, etc.) |

---

## Flujo Propuesto (2 pasos)

### Paso 1: `generateTrainingPlan` (Mutation)

```
1. PlanValidator.validate(userId)
   └─ Si falta data → error con listado de campos faltantes
2. UserProfileService.getFullProfileContext(userId)
   └─ Obtiene los 8 sub-documentos (profile, goal, schedule, health, resources, preferences, strengthMetrics, weightLogs)
3. buildUserContextForAI(data)
   └─ Transforma a JSON limpio para el prompt
4. PlanGeneratorPrompt.build(context)
   └─ Construye system + user prompt según data disponible
5. AiService.executePrompt({ provider: 'groq', system, user })
   └─ Llama a Groq, recibe JSON crudo
6. PlanGeneratorParser.parse(rawResponse)
   └─ Limpia ```json, valida estructura, mapea ejercicios
7. TrainingPlanModel.create({ ...plan, status: DRAFT })
   └─ Guarda borrador con AiSnapshot (contexto enviado + respuesta cruda)
8. Retorna plan preview (semanas, días, ejercicios + trainingPlanId)
```

### Paso 2: `confirmTrainingPlan` (Mutation)

```
1. TrainingPlanService.findOne(trainingPlanId)
   └─ Verifica que exista y esté en status DRAFT
2. Por cada semana del plan:
   a. WeekLogService.create({
        startDate,     // "yyyy-MM-dd" calculada
        endDate,       // "yyyy-MM-dd" (startDate + 6 días)
        timezone,      // del perfil del usuario
        planId,        // trainingPlanId
      })
   └─ Crea el WeekLog + WorkoutSessions a través del CreateWeekLogUseCase
3. TrainingPlanModel.update({ status: ACTIVE })
4. Retorna el/los WeekLogs creados
```

### Diagrama de dependencias

```
TrainingPlanResolver
  └─ TrainingPlanService (facade)
       ├─ PlanValidator → verifica datos mínimos en UserProfile
       ├─ UserProfileService.getFullProfileContext() → obtiene perfil completo
       ├─ buildUserContextForAI() → transforma a JSON para IA
       ├─ PlanGeneratorPrompt.build() → arma prompts
       ├─ AiService.executePrompt() → llama a Groq
       ├─ PlanGeneratorParser.parse() → procesa respuesta
       ├─ TrainingPlanModel → guarda borrador (DRAFT)
       └─ WeekLogService.create() → crea WeekLogs al confirmar
```

---

## Responsabilidad de Módulos

| Módulo | Responsabilidad |
|---|---|
| **AI** | Proveer `AiService` con providers (Groq, etc.). No sabe de dominios. |
| **TrainingPlan** | Orquestar la generación (validación → IA → borrador → confirmación). Depende de AI + UserProfile + WeekLog. |
| **UserProfile** | Exponer datos del usuario. No sabe de planes ni IA. |
| **WeekLog** | Crear y gestionar WeekLogs + WorkoutSessions. El training-plan lo invoca, no duplica su lógica. |

---

## Archivos a Modificar/Crear

### TrainingPlan Module (`src/modules/training-plan/`)

| Archivo | Acción |
|---|---|
| `plan-validator.service.ts` | **Crear** — Validación de campos mínimos |
| `plan-generator.prompt.ts` | **Implementar** — Builder de prompts |
| `plan-generator.parser.ts` | **Crear** (renombrar, eliminar typo) — Parser de respuesta JSON |
| `plan-generator.service.ts` | **Actualizar** — Usar `getFullProfileContext`, integrar validator/prompt/parser |
| `training-plan.service.ts` | **Implementar** — Lógica real CRUD + confirmPlan |
| `training-plan.resolver.ts` | **Implementar** — Mutaciones reales (generate, confirm, CRUD) |
| `dto/create-training-plan.input.ts` | **Implementar** — Input real |
| `dto/confirm-training-plan.input.ts` | **Crear** — Input para confirmación |
| `entities/training-plan.entity.ts` | **Implementar** — GraphQL output type real |

### AI Module (`src/modules/ai/`)

| Archivo | Acción |
|---|---|
| `README.md` | ✅ Este archivo |
| *(ningún cambio necesario)* | El módulo ya está completo |

### UserProfile Module

| Archivo | Acción |
|---|---|
| *(ningún cambio necesario)* | `getFullContextProfile` + `buildUserContextForAI` ya existen |
