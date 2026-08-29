# WaveFit API - Guía para Agentes IA

## 1. Proyecto

- **Backend:** NestJS 11 + GraphQL (Apollo) + MongoDB
- **Frontend:** Angular 20 (otro repositorio)
- **Auth:** JWT (cookie HttpOnly) + Google OAuth (PKCE)
- **DB:** MongoDB (Mongoose)

---

## 2. Propósito

- Gestionar ejercicios personalizados (Template)
- Gestionar rutinas (RoutinePlan → RoutineDay)
- Tracking de entrenamiento (WorkoutSession, WeekLog, ExtraSession)
- Registro de cambios en DB (AuditLogs)

---

## 3. Estructura de Módulos

```
src/modules/
├── auth/                    # JWT + Google OAuth
│   ├── auth.service.ts
│   ├── auth.resolver.ts
│   ├── jwt.strategy.ts
│   ├── local.strategy.ts
│   ├── guards/
│   │   └── gql-auth.guard.ts
│   └── google/              # OAuth Google
├── user/                    # Gestión usuarios
├── routines/
│   ├── templates/
│   │   ├── exercise/        # Catálogo ejercicios
│   │   ├── routine-day/     # Días de rutina
│   │   └── routine-plan/    # Planes semanales
│   └── tracking/
│       ├── workout-session/ # Sesiones de entrenamiento
│       ├── week-log/        # Registro semanal (gestión completa de WS/ES)
│       ├── day-log/         # Día suelto de entrenamiento (scaffold)
│       └── extra-session/   # Sesiones extras
├── ai/                       # IA: proveedores LLM (Groq), rate limit, retry/backoff
├── training-plan/            # Planes de entrenamiento generados con IA (generatePlan/confirmPlan)
├── stats/                    # Métricas y estadísticas (placeholder)
└── audit-logs/              # Registro cambios en DB

---

## 4. Arquitectura

### Flujo de datos
```
Resolver → Service → Schema (MongoDB)
           ↓
     AuditLogs (interceptor)
```

### Capas

| Capa | Responsabilidad | Ejemplo |
|------|-----------------|---------|
| **Resolver** | Queries/Mutations GraphQL | `auth.resolver.ts` |
| **Service** | Lógica de negocio | `user.service.ts` |
| **Schema** | Modelo Mongoose | `user.schema.ts` |
| **DTO/Input** | Validación de entrada | `create-user.input.ts` |

### Arquitectura Hexagonal (Clean Architecture)

Los módulos de tracking complejos (week-log, day-log) utilizan una arquitectura de 4 capas con inversión de dependencias:

| Capa | Directorio | Responsabilidad | Depende de |
|------|------------|-----------------|------------|
| **Presentation** | `presentation/` | DTOs GraphQL, entidades de salida | — |
| **Application** | `application/use-cases/` | Casos de uso, validadores | Domain (interface) |
| **Domain** | `domain/` | Entidades de dominio, interfaces de repositorio | — |
| **Infrastructure** | `infrastructure/` | Schemas Mongoose, implementación del repositorio | Domain (interface) |

**Flujo de dependencias:** `Resolver → Service → UseCase → Domain (interface) ← Infrastructure (implementación)`

**Estado de migración:**

| Módulo | Estado | Capas implementadas |
|--------|--------|---------------------|
| week-log | ✅ Completo | presentation, application (5 use cases), domain, infrastructure |
| day-log | 🏗️ Scaffold | presentation, application (use cases stub), domain (vacío), infrastructure (vacío) |
| Resto de módulos | 📋 Patrón clásico | Resolver → Service → Schema |

---

## 5. Autenticación (IMPORTANTE)

### Token en Cookie (NO en header)

El JWT se transmite en cookie `HttpOnly` llamada `token`:
- **NO** usar header `Authorization: Bearer <token>`
- El cliente **nunca** tiene acceso al token (mitiga XSS)
- Extracción del token desde cookie configurada en `JwtStrategy`

### Protección de Resolvers

```typescript
@Resolver(() => User)
@UseGuards(GqlAuthGuard)
export class UserResolver {
  @Query(() => User)
  async me(@Context() context) {
    return context.req.user;
  }
}
```

### Flujos de Login

1. **Email/Password**: `AuthResolver.login` → valida con bcrypt → genera JWT → cookie
2. **Google OAuth**: `GoogleResolver.loginWithGoogle` → intercambia code + codeVerifier → vincula/crea usuario → JWT → cookie

### Cookies

| Atributo | Desarrollo | Producción |
|----------|------------|------------|
| HttpOnly | true | true |
| Secure | false | true |
| SameSite | 'lax' | 'none' |
| MaxAge | 7 días | 7 días |

---

## 6. GraphQL

- **Playground:** Enabled en desarrollo
- **Schema:** Auto-generado desde código (`autoSchemaFile: true`)
- **Validación:** class-validator en DTOs
- **Contexto:** `{ req, res }` disponible en todos los resolvers

---

## 7. Modelos de Datos

### Rama TEMPLATE ( Rutinas establecidas )

| Modelo | Descripción |
|--------|-------------|
| Exercise | Catálogo de ejercicios |
| RoutineDay | Un día de entrenamiento |
| RoutinePlan | Plan semanal (contiene RoutineDays) |

### Rama TRACKING ( Seguimiento )

| Modelo | Descripción |
|--------|-------------|
| WorkoutSession | Sesión de entrenamiento completada |
| WeekLog | Resumen semanal de entrenamiento. **Contiene y gestiona** WorkoutSession y ExtraSession como sub-recursos en `days[]` |
| ExtraSession | Sesión adicional fuera del plan |
| DayLog | Día suelto de entrenamiento (sin semana). Scaffold actual. |

### OTROS

| Modelo | Descripción |
|--------|-------------|
| Stat | Métricas y estadísticas (placeholder — a implementar) |

---

## 8. Convenciones

- **NestJS:** Módulos standalone con imports explícitos
- **Naming:**
  - Archivos: `kebab-case.ts`
  - Clases: `PascalCase`
  - DTOs: `*.input.ts`, `*.output.ts`
- **Testing:** Jest, archivos `*.spec.ts`

---

## 9. Rutas GraphQL

```
Auth:
  login(identifier, password) -> Boolean
  logout -> Boolean
  me -> User

User:
  findAll, findOne, create, update, remove

Exercise:
  findAll, findOne, create, update, remove

RoutinePlan:
  findAll, findOne, create, update, remove, isRoutineTitleAvailable

RoutineDay:
  findAll, findOne, create, update, remove

WorkoutSession:
  findAll, findOne, create, update, remove

WeekLog:
  createWeekLog, findAll, findOne, activeWeekLog, currentWorkoutSession,
  updateDay, updateDayWorkoutStatus, updateWeekLog, assignRoutineToDay,
  removeWorkoutSessionFromDay, removeExtraSessionFromDay,
  syncWeekLogDays, removeWeekLog

DayLog:
  createDayLog, dayLog (findAll), dayLog (findOne), updateDayLog, removeDayLog

Stats:
  createStat, stats (findAll), stat (findOne), updateStat, removeStat

AI:
  aiUsageStatus -> { used, limit, remaining, resetAt }

TrainingPlan:
  createTrainingPlan, trainingPlans, trainingPlan, updateTrainingPlan,
  removeTrainingPlan, generatePlan, confirmPlan, removePlan
```

---

## 10. Seeding, Control de Nombres y Tests E2E

### Database Seeds
El proyecto incluye un sistema de autoseeding (`src/database/seed-runner.ts`) que se ejecuta automáticamente al levantar la app (`OnApplicationBootstrap`).
- Si la DB está vacía, inserta automáticamente el catálogo de ejercicios base, un plan de rutina PPL por defecto y los días de rutina.
- Si ya existen ejercicios, el proceso de seed se omite para no duplicar datos.
- Cada ejercicio se guarda con `normalizedName` para búsquedas normalizadas.
- Documentación detallada: `documents/config/seed.md`

### Control de Nombres Similares (fastest-levenshtein)
El proyecto usa el algoritmo de distancia de Levenshtein (`fastest-levenshtein`) para detectar nombres duplicados o sospechosamente parecidos:

- **Implementado en:** Exercise (create/update) — `isSimilar()` en `src/common/utils/string.utils.ts`
- **Pendiente:** Extender a RoutineDay (title) y RoutinePlan (name)
- Incluye detección de palabras opuestas (push/pull, inclinado/declinado, etc.) para evitar falsos positivos

### Tests Unitarios
Suite completa verde en `src/`:
- **46 suites / 240 tests** (tracking, auth, user-profile, templates, etc.)
- Comando: `npm test` — al filtrar por ruta usar SIEMPRE `npx jest --config jest.config.js <ruta>` (configuración dual de Jest)
- Patrones de mocks documentados en `documents/config/testing.md`

### Tests End-to-End (E2E)
Se han implementado tests automatizados que prueban flujos completos:
- **21 spec files / 112 tests** en `test/e2e/` cubriendo auth, week-log (CRUD, extra-session, workout-session) y user-profile (incluye aislamiento entre usuarios)
- Infraestructura: MongoDB en memoria (`mongodb-memory-server`), `supertest`, `cookie-parser`
- Comando: `npm run test:e2e` (fijado `--maxWorkers=2` por condiciones de carrera con más workers)
- Documentación detallada: `documents/config/testing.md`

---

## 11. Comandos

```bash
npm run start         # Production (node dist/main.js)
npm run start:dev    # Desarrollo con watch
npm run build        # Compilar TypeScript
npm run lint         # ESLint
npm run format       # Prettier
npm test             # Tests unitarios
npm run test:cov     # Tests con coverage
npm run test:e2e     # Tests end-to-end
```

---

## 12. Documentos de Referencia

| Escenario | Archivo |
|-----------|---------|
| Flujos de login | `documents/config/login_flows.md` |
| Configuración cookies | `documents/config/cookie_configuration.md` |
| Autenticación general | `documents/config/authentication.md` |
| Módulo auth detallado | `documents/config/auth_module.md` |
| Tests de auth | `src/modules/auth/Readme.md` |
| Seed y autoseeding | `documents/config/seed.md` |
| Tests E2E detallado | `documents/config/testing.md` |
| Módulo AI y generación de planes | `documents/config/ai.md` |

> **Importante:** Antes de modificar código de autenticación o tracking, leer los documentos de referencia en `documents/config/`.

---

## 13. Variables de Entorno Requeridas

```bash
JWT_SECRET=          # Secret para firmar tokens
JWT_EXPIRATION=7d    # Duración del token
DB_MONGO_PASSWORD=   # Password MongoDB Atlas
FRONTEND_URL=       # URL del frontend (CORS)
GOOGLE_CLIENT_ID=   # OAuth Google
GOOGLE_CLIENT_SECRET= # OAuth Google
GROQ_API_KEY=       # API key del proveedor IA (Groq)
PREFERRED_AI_PROVIDER=groq # Proveedor default del plan-generator ('groq')

# Módulo AI (rate limit + retry/backoff)
AI_DAILY_LIMIT=10        # Máximo de llamadas a IA por usuario/día UTC
AI_CALL_TIMEOUT_MS=45000 # Timeout por intento en el cliente ChatGroq
AI_MAX_ATTEMPTS=3        # Intentos totales ante fallos transitorios (1 + 2 retries)
AI_TOTAL_BUDGET_MS=80000 # Presupuesto global compartido entre reintentos
AI_MAX_OUTPUT_TOKENS=5000 # Presupuesto de tokens de salida (combate content vacío)

---

## 14. Day-Log (Día Suelto de Entrenamiento)

### Propósito
Permite al usuario crear un día de entrenamiento **sin necesidad de una semana completa**. Ideal para entrenamiento ad-hoc o días sueltos fuera del plan semanal.

### Estado Actual
| Capa | Estado |
|------|--------|
| `presentation/` | ✅ DTOs y entidad GraphQL definidos |
| `application/use-cases/` | 🏗️ 6 use cases creados pero retornan placeholders |
| `application/validators/` | ✅ Validator stub creado |
| `domain/` | ❌ Vacío (sin entidades ni interfaces) |
| `infrastructure/` | ❌ Vacío (sin schema ni repositorio) |

### Próximos Pasos
1. Definir entidad de dominio `DayLogDomain` e interfaz `IDayLogRepository`
2. Crear schema Mongoose `day-log.schema.ts`
3. Implementar repositorio concreto
4. Implementar lógica real en los use cases
5. Conectar resolver con la lógica real

---

## 15. Stats (Métricas y Estadísticas)

### Propósito
Módulo planeado para exponer métricas de entrenamiento del usuario:

- Volumen semanal (peso total × repeticiones × series)
- Frecuencia de ejercicios por período
- Progresión de cargas por ejercicio
- Días entrenados vs programados (adherencia)

### Estado Actual

**⚠️ MÓDULO EXPERIMENTAL** (actualizado 2026-08-23). Ya NO es un placeholder de NestJS CLI: tiene 32 archivos / ~692 líneas con arquitectura hexagonal (use cases de adherence, personal-records, top-exercises, top-routines, event-publisher y repositorio). Sin embargo, **no está activo en producción** y por decisión se mantiene **fuera de la suite de tests** (0% cobertura).

| Archivo | Estado |
|---------|--------|
| `stats.module.ts` | ✅ Registrado en app.module.ts |
| `application/use-cases/` | ✅ 8 use cases (get/save adherence, PRs, top-exercises, top-routines) |
| `infrastructure/repositories/` | ✅ StatsRepository implementado |
| `domain/` | ✅ Entidades e interfaz de repositorio |
| `presentation/dto/` | ✅ save-stats.input, worker-raw-data.output |
| Tests | ❌ Sin specs (experimental — prioridad baja) |

> Si el módulo se activa a futuro, empezar por los use cases puros (`save-*`, `get-raw-data-for-worker`) según `documents/reports/cobertura-tests-2026-08-21.md`.

### Planeado a Futuro
- Definir modelo de datos de métricas
- Implementar agregaciones sobre WorkoutSession y WeekLog
- Endpoints para dashboard de progreso
```

---

## 16. AI y Generación de Planes (Implementado)

**Documentación detallada:** `documents/config/ai.md`

### Módulo `ai/` (capa transversal)
- **`AiService.executePrompt()`**: rate limit por usuario → proveedor → reintentos con backoff y presupuesto. Es el único punto de llamada al LLM.
- **Rate limit:** fixed window diario UTC. Colección `ai_usage` (índice único `userId + windowStart`, TTL 2 días). Límite `AI_DAILY_LIMIT` (default 10). Exposición: `aiUsageStatus`.
- **Reintentos:** solo errores transitorios (timeout, red, 5xx, 429, respuesta vacía). Timeout/limit/budget desde env. `ChatGroq` con `maxRetries: 0` (la única capa de retry vive en `AiService`).
- **Proveedores:** patrón estrategia vía token `'AI_PROVIDERS'` (`IAiProvider`: `name` + `getModel()`). Hoy solo `groq` (`openai/gpt-oss-120b`, `temperature: 0`).
- **Errores:** taxonomía `AI_CAUSE` (`AI_PROVIDER_ERROR`, `AI_MALFORMED_JSON`, `AI_EMPTY_RESPONSE`, `AI_UNKNOWN_EXERCISE_NAME`, `RATE_LIMIT_EXCEEDED`).
- **Auditoría:** cada llamada de IA y generación/confirmación de plan registra `AuditLogs`.

### Módulo `training-plan/` (generación con IA)
- **`generatePlan(comment)`** → valida perfil (`PlanValidatorService`) → snapshot `Goal` → prompt (contexto + catálogo de nombres únicos) → IA → parser (JSON 7 días) → materializer (resuelve nombres IA → catálogo por capas exact/folded/subset/levenshtein) → persiste `TrainingPlan` en `draft` con `aiSnapshot`.
- **Idempotencia:** locks en memoria (single-node): `TrainingPlanService` por `userId+comment`, `PlanGeneratorService` por `userId`.
- **`confirmPlan(id, action)`** → `create_week_log` (WeekLog + sesiones, 409 si hay semana activa) | `create_routine_plan` (template RoutinePlan con `isAiGenerated: true`) | `adapt_active_week` (reservado, 501). Confirmación atómica vía `findOneAndUpdate({ confirmed: false })`.

> **Importante:** antes de modificar código de `ai/` o `training-plan/`, leer `documents/config/ai.md`.
