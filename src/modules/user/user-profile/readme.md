````
user-profile/
├── user-profile.module.ts      ← Module registra schemas y providers
├── index.ts                     ← Barrel export
├── user-profile.service.ts      ← Perfil base + agregación de contexto + dominios no migrados
├── user-profile.resolver.ts     ← Queries/Mutations del perfil base (auth por guard)
├── user-profile.utils.ts        ← extractUserId, Epley, BMR, buildUserContextForAI()
│
├── goals/                       ← Bounded context: objetivos
│   ├── goals.resolver.ts        ← updateUserGoals, userGoals
│   ├── goals.service.ts         ← Acceso exclusivo a UserGoal
│   └── dto/update-goals.input.ts
│
├── training-preference/         ← Bounded context: preferencias de entrenamiento
│   ├── training-preference.resolver.ts  ← updateUserTrainingPreference, userTrainingPreference
│   ├── training-preference.service.ts   ← Acceso exclusivo a UserTrainingPreference
│   └── dto/update-training-preference.input.ts
│
├── weight/                      ← Bounded context: historial de peso
│   ├── weight.resolver.ts       ← createWeightLog, userWeightLogs
│   ├── weight.service.ts        ← Acceso exclusivo a UserWeightLog
│   └── dto/create-weight-log.input.ts
│
├── entities/
│   └── *.entity.ts              ← GraphQL ObjectType (output) — compartidos
├── dto/                         ← DTOs del perfil base y dominios aún no migrados
└── schema/
    ├── user-profile.schema.ts         ← Biometría base
    ├── goals.schema.ts                ← Objetivo activo
    ├── strength-metrics.schema.ts     ← 1RM por ejercicio
    ├── resourse.schema.ts             ← Equipamiento disponible
    ├── schedule.schema.ts             ← Disponibilidad semanal
    ├── health-constraints.schema.ts   ← Lesiones / limitaciones
    ├── training-performance.schema.ts ← Estilo y preferencias
    └── weight.schema.ts               ← Historial de peso
````

### Arquitectura

- **UserProfileService** conserva: CRUD del perfil base, health-constraints,
  schedule, resource, strength-metrics y `getFullProfileContext()`
  (agregación cross-domain que delega en los servicios especializados).
- **Servicios especializados** (`GoalsService`, `TrainingPreferenceService`,
  `WeightService`): única fuente de acceso a su colección.
- Los schemas Mongoose y entities GraphQL viven arriba porque se comparten
  entre el contexto agregado y los bounded contexts.

### GraphQL Endpoints

| Query/Mutation                    | Descripción                             | Resolver                  |
| --------------------------------- | --------------------------------------- | ------------------------- |
| `createUserProfile(input)`        | Crear perfil biométrico (1 por usuario) | UserProfileResolver       |
| `userProfiles`                    | Listar todos los perfiles (admin)       | UserProfileResolver       |
| `userProfile(id)`                 | Buscar perfil por ID                    | UserProfileResolver       |
| `myProfile`                       | Perfil del usuario autenticado          | UserProfileResolver       |
| `userProfileContext`              | Contexto completo del perfil            | UserProfileResolver       |
| `updateUserProfile(input)`        | Actualizar perfil                       | UserProfileResolver       |
| `upsertUserProfile(input)`        | Crear o actualizar si ya existe         | UserProfileResolver       |
| `removeUserProfile(id)`           | Eliminar perfil                         | UserProfileResolver       |
| `updateUserGoals(input)`          | Upsert de objetivos                     | GoalsResolver             |
| `userGoals`                       | Objetivos del usuario                   | GoalsResolver             |
| `updateUserTrainingPreference(i)` | Upsert preferencias                     | TrainingPreferenceResolver|
| `userTrainingPreference`          | Preferencias del usuario                | TrainingPreferenceResolver|
| `createWeightLog(input)`          | Registrar peso                          | WeightResolver            |
| `userWeightLogs`                  | Historial de peso                       | WeightResolver            |

### Utilidades (`user-profile.utils.ts`)

- `extractUserId(context)` → Valida y extrae el userId del contexto JWT
- `estimateOneRm(weightKg, reps)` → Fórmula de Epley: `1RM = w * (1 + r/30)`
- `bmrMifflinStJeor(weightKg, heightCm, ageYears, sex)` → Tasa metabólica basal
- `buildUserContextForAI(data)` → Arma un objeto unificado con todos los datos del perfil para enviar a un assistant de IA

### Pendiente / Próximos pasos

- Migrar los dominios restantes al patrón de bounded contexts:
  health-constraints, schedule, resource, strength-metrics
- Tests unitarios con casos reales (mocks de Mongoose)
- Tests e2e de los endpoints
