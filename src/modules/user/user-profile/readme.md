```
user-profile/
├── user-profile.module.ts      ← Module registra schemas en NestJS
├── index.ts                     ← Barrel export
├── user-profile.service.ts      ← CRUD completo con Mongoose
├── user-profile.resolver.ts     ← Queries/Mutations GraphQL con auth
├── user-profile.utils.ts        ← Epley, BMR, buildUserContextForAI()
├── entities/
│   └── user-profile.entity.ts   ← GraphQL ObjectType (output)
├── dto/
│   ├── create-user-profile.input.ts  ← Create DTO con validación
│   └── update-user-profile.input.ts  ← Partial del create
└── schema/
    ├── user-profile.schema.ts         ← Biometría base
    ├── goals.schema.ts                ← Objetivo activo
    ├── strength-metrics.schema.ts     ← 1RM por ejercicio
    ├── resourse.schema.ts             ← Equipamiento disponible
    ├── schedule.schema.ts             ← Disponibilidad semanal
    ├── health-constraints.schema.ts   ← Lesiones / limitaciones
    ├── training-performance.schema.ts ← Estilo y preferencias
    └── weight.schema.ts               ← Historial de peso
```

### GraphQL Endpoints

| Query/Mutation             | Descripción                             |
| -------------------------- | --------------------------------------- |
| `createUserProfile(input)` | Crear perfil biométrico (1 por usuario) |
| `userProfiles`             | Listar todos los perfiles (admin)       |
| `userProfile(id)`          | Buscar perfil por ID                    |
| `myProfile`                | Perfil del usuario autenticado          |
| `updateUserProfile(input)` | Actualizar perfil                       |
| `upsertUserProfile(input)` | Crear o actualizar si ya existe         |
| `removeUserProfile(id)`    | Eliminar perfil                         |

### Utilidades (`user-profile.utils.ts`)

- `estimateOneRm(weightKg, reps)` → Fórmula de Epley: `1RM = w * (1 + r/30)`
- `bmrMifflinStJeor(weightKg, heightCm, ageYears, sex)` → Tasa metabólica basal
- `buildUserContextForAI(data)` → Arma un objeto unificado con todos los datos del perfil para enviar a un assistant de IA

### Pendiente / Próximos pasos

- Implementar resolvers específicos para cada sub-schema (goals, strength-metrics, resource, schedule, health-constraints, preferences, weight-logs)
- Tests unitarios para el service con mocking de Mongoose
- Tests e2e de los endpoints
