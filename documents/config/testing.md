# Testing — Documentación (Unitarios + E2E)

## 1. Vista General

| Suite | Ubicación | Suites | Tests | Comando |
|-------|-----------|--------|-------|---------|
| **Unitarios** | `src/**/*.spec.ts` | 55 | 456 | `npm test` |
| **E2E** | `test/e2e/*.spec.ts` | 22 | 117 | `npm run test:e2e` |

Ambas suites están completamente verdes y son independientes entre sí:
los unitarios mockean dependencias con Jest; los E2E levantan la app completa
contra MongoDB en memoria.

> ⚠️ **IMPORTANTE:** El proyecto tiene configuración dual de Jest (`jest.config.js`
> para unitarios + clave `jest` en `package.json`). Al correr unitarios por CLI,
> SIEMPRE pasar `--config jest.config.js` explícito, si no Jest falla con
> *"multiple configurations found"*.

---

## 2. Comandos

```bash
# ── Unitarios ──────────────────────────────────────────────
npm test                                          # todos los de src/
npx jest --config jest.config.js <ruta>           # un módulo/archivo específico
npx jest --config jest.config.js <ruta> --verbose # lista test por test
npm run test:cov                                  # cobertura

# ── E2E ────────────────────────────────────────────────────
npm run test:e2e                                  # suite completa (--maxWorkers=2)
npx jest --config ./test/jest-e2e.json test/e2e/auth/login.spec.ts   # archivo suelto

# ── Cobertura combinada (unit + e2e) ───────────────────────
npm run test:e2e:cov        # solo E2E con cobertura (→ coverage/e2e/)
npm run test:cov:combined   # unit + e2e + merge → coverage/combined/ y resumen en consola
```

### Cobertura combinada (unit + e2e)

`scripts/merge-coverage.js` mergea los mapas de istanbul de ambas suites
(`coverage/coverage-final.json` + `coverage/e2e/coverage-final.json`),
escribe el reporte combinado en `coverage/combined/` y muestra un resumen
ponderado por archivo. Referencia medida (2026-08-23):

| Fuente | Líneas | Branches |
|--------|--------|----------|
| Unitarios solos | 51.33% | 49.05% |
| E2E solos | 54.02% | 42.39% |
| **Combinada (ponderada)** | **67.49%** | **60.66%** |

Los flujos que más aportan vía E2E: week-log (use cases 82–100%, resolver ~94%,
repositorio ~70%) y auth. Áreas aún frías: stats (experimental, fuera de
alcance), day-log (scaffold), google.service (requiere OAuth real).

**¿Por qué `--maxWorkers=2` en e2e?** Con más workers, `mongodb-memory-server`
y el seeding automático generan condiciones de carrera y datos cruzados entre
suites. Fijado en `package.json`.

---

## 3. Distribución de los Unitarios (240 tests / 46 suites)

| Área | Suites | Tests | Contenido principal |
|------|--------|-------|---------------------|
| Tracking (week-log, workout-session, extra-session, day-log) | 8 | 139 | Services + resolvers; week-log testeado vía use cases (arquitectura hexagonal) |
| Auth + Storage + AI + AuditLogs | 12 | 69 | Estrategias JWT/local/google, guards, interceptor de auditoría, integración Google OAuth |
| User + UserProfile (+ sub-recursos) | 18 | 24 | CRUD usuario, perfil, goals/schedule/constraints/resource/preference/strength-metrics/weight |
| Templates + TrainingPlan + App | 8 | 8 | Smoke "should be defined" con DI correcta |

### Patrones usados en los mocks

1. **Modelo Mongoose** — token por nombre de CLASE (no del objeto Schema):
   ```typescript
   // El módulo registra { name: Exercise.name, schema: ExerciseSchema }
   // → el token correcto es getModelToken(Exercise.name) === 'ExerciseModel'
   { provide: getModelToken(Exercise.name), useValue: exerciseModelMock }
   ```
   Usar `getModelToken(ExerciseSchema.name)` produce tokens sin match porque
   `ExerciseSchema` es una instancia de mongoose Schema, no la clase.

2. **EventEmitter2** — los resolvers emiten eventos (`workout-session.saved`, etc.):
   ```typescript
   { provide: EventEmitter2, useValue: { emit: jest.fn() } }
   ```

3. **Servicios hexagonales (week-log)** — el service delega en use cases;
   se mockea `.execute()` de cada use case, no cadenas del modelo.

4. **Interceptores** — `AuditInterceptor(reflector, auditService)` se puede
   instanciar directo o sobreescribir con `overrideInterceptor(...)`.

5. **Alineación conductual** — los tests reflejan el comportamiento ACTUAL,
   no el histórico. Ejemplos relevantes:
   - `WeekLogResolver.createWeekLog` refresca el resultado vía `service.findOne()`
     después de crear → el test debe mockear ambos métodos.
   - `findActiveWeekLog` devuelve wrapper `{ hasActiveWeek: true, week }`.
   - `ExtraSessionService.create` AUTO-CREA la WorkoutSession si no existe
     (ya no lanza NotFoundException).
   - Calorías de ExtraSession: `MET × 70kg × horas × factorIntensidad`,
     con input de usuario aceptado solo dentro de ±400 cal del estimado.
   - El login Google ahora descarga el avatar (`getAvatarGoogle`) y lo sube
     vía `StorageService` antes de firmar el JWT.

---

## 4. Infraestructura E2E

### MongoDB en Memoria (`test/utils/db-handler.ts`)

Usa `mongodb-memory-server` para levantar una instancia MongoDB efímera:

- `rootMongooseTestModule()` — reemplaza `MongooseModule.forRoot()` por una conexión a MongoDB en memoria
- `closeInMongodConnection()` — desconecta y detiene el servidor (afterAll)
- `clearDatabase()` — limpia SOLO las colecciones de datos entre tests (beforeEach).
  No toca colecciones de sistema/índices: borrarlas todo causaba fallos
  intermitentes entre runs.

### AppTestModule (`test/utils/app-test.module.ts`)

Módulo NestJS que replica la configuración real pero con:

- `MongooseModule` apuntando a MongoDB en memoria
- GraphQL playground deshabilitado
- Mismos módulos que la app real (User, Auth, WeekLog, Exercise, etc.)
- `GraphQLExceptionFilter` para capturar errores

> ⚠️ El bootstrap del e2e DEBE registrar `app.use(cookieParser())`: el JWT viaja
> en cookie HttpOnly y sin ese middleware toda la autenticación falla.

### Fixtures (`test/fixtures/user.fixture.ts`)

Datos de usuario predefinidos para tests:

- Email: `test@wavefit.com`
- Password: `password123`
- Rol: `USER`

Funciones: `createTestUser()`, `getTestUserCredentials()`

### Helpers (`test/e2e/helpers/week-log.helper.ts`)

- `getCookieWithToken()` — extrae cookie `token=` del header `set-cookie` tras login
- `createWeekLog()` — crea WeekLog con fechas de la semana actual
- `getActiveWeekLog()` / `getActiveWeekLogBasic()` — consulta WeekLog activo
- `createAndCompleteWeekLog()` — completa un WeekLog existente y crea uno nuevo (para tests que necesitan históricos)

### Types (`test/e2e/types/week-log.type.ts`)

Objetos `expect` reutilizables para validar la forma de las respuestas GraphQL:

- `WEEK_LOG_TYPE`
- `WEEK_LOG_DAY_TYPE`
- `ACTIVE_WEEK_LOG_RESPONSE_TYPE`
- `WEEK_LOG_FIELDS` (string de campos GraphQL)

---

## 5. Estructura de Archivos E2E (21 specs)

```
test/
├── e2e/
│   ├── auth/
│   │   ├── login.spec.ts
│   │   ├── logout.spec.ts
│   │   └── me.spec.ts
│   ├── user-profile/
│   │   ├── create-user-profile.spec.ts    (10 tests)
│   │   ├── update-user-profile.spec.ts    (7 tests)
│   │   ├── sub-resources.spec.ts          (25 tests)
│   │   └── isolation.spec.ts              (4 tests)
│   ├── week-log/
│   │   ├── create-week-log.spec.ts
│   │   ├── find-all.spec.ts
│   │   ├── find-one.spec.ts
│   │   ├── update-week-log.spec.ts
│   │   ├── update-day-log.spec.ts
│   │   ├── update-day-workout-status.spec.ts
│   │   ├── remove-week-log.spec.ts
│   │   ├── active-week.spec.ts
│   │   ├── repro-bug.spec.ts
│   │   ├── extra-session/
│   │   │   ├── add-extra-session.spec.ts
│   │   │   ├── remove-extra-session.spec.ts
│   │   │   ├── update-extra-session.spec.ts
│   │   │   └── extra-session-catalog.spec.ts
│   │   └── workout-session/
│   │       └── assign-with-routine.spec.ts
│   ├── helpers/
│   │   └── week-log.helper.ts
│   └── types/
│       └── week-log.type.ts
├── utils/
│   ├── app-test.module.ts
│   └── db-handler.ts
├── fixtures/
│   └── user.fixture.ts
├── setup.ts
└── app.e2e-spec.ts
```

---

## 6. Tests E2E de Auth

### login.spec.ts (3 tests)
| Test | Descripción |
|------|-------------|
| should login with valid credentials and set cookie | Login exitoso, verifica cookie `token=` en respuesta |
| should fail login with incorrect password | Password incorrecto → error `Invalid credentials` |
| should fail login with non-existent user | Email inexistente → error `Invalid credentials` |

### logout.spec.ts
Verifica que la mutation `logout` limpia la cookie del token.

### me.spec.ts
Verifica que la query `me` retorna el usuario autenticado cuando se envía la cookie.

---

## 7. Tests E2E de User Profile (46 tests)

Área agregada recientemente. Cubre el ciclo completo del perfil de usuario
y sus sub-recursos, incluyendo aislamiento entre usuarios.

### create-user-profile.spec.ts
| Test | Descripción |
|------|-------------|
| should return null on myProfile when user has no profile | Usuario nuevo sin perfil |
| should return an empty list of userProfiles when no profiles exist | Colección vacía |
| should create a profile from an empty user | Alta desde cero |
| should create a profile with only required fields and null optionals | Campos opcionales quedan null |
| should persist the created profile and return it via myProfile | Persistencia real verificada vía query |
| should reject creating a second profile for the same user | Unicidad 1 perfil / usuario |
| should reject an invalid gender value | Validación enum gender |
| should reject an invalid birthDate value | Validación fecha nacimiento |
| should reject heightCm below the allowed range | Rango mínimo altura |
| should create a profile via upsertUserProfile when user is empty | Upsert como creación |

### update-user-profile.spec.ts
| Test | Descripción |
|------|-------------|
| should update saved data (heightCm and weightKg) | Actualización básica |
| should persist the changes retrievable via myProfile | Verificación post-update |
| should support partial updates without touching other fields | Update parcial |
| should update instead of duplicating when upsert is called on existing profile | Upsert idempotente |
| should reject an invalid profile id format | ObjectId inválido |
| should reject an update when id is missing | Id requerido |
| should reject an update with a non-existent but valid ObjectId | Id válido pero inexistente |

### sub-resources.spec.ts
Un bloque `describe` por sub-recurso, cada uno con patrón
crear-desde-vacío / persistir-modificación / validar-rango:

| Sub-recurso | Tests | Valida además |
|-------------|-------|---------------|
| Goals | 3 | primaryGoal inválido rechazado |
| Schedule | 3 | daysPerWeek fuera de rango |
| Health constraints | 3 | bodyPart inválido |
| Resource | 3 | trainingEnvironments vacío |
| Training preference | 3 | preferredStyles inválido |
| Strength metrics | 3 | remove por id inexistente |
| Weight logs | 3 | orden descendente por loggedAt, peso bajo mínimo |
| userProfileContext | 2 | agregación completa para contexto IA |

### isolation.spec.ts
| Test | Descripción |
|------|-------------|
| should not expose user A profile to user B via myProfile or userProfile(id) | Sin fugas cross-user |
| should reject user B updating the profile of user A | Ownership en updates |
| should allow each user to have and see their own profile | Aislamiento positivo |
| should not expose goals of user A to user B | Sub-recursos también aislados |

---

## 8. Tests E2E de WeekLog

### create-week-log.spec.ts
| Test | Descripción |
|------|-------------|
| should create a week log without plan | Crea WeekLog sin planId, verifica 7 días generados |
| should create a week log with a plan | Crea WeekLog con plan PPL, verifica WorkoutSessions iniciales creadas en días no-rest |
| should create a week log for second week | Crea WeekLog, completa activo, crea segundo WeekLog, verifica que el primero está inactivo |
| should fail to create a week log when there is an active week log already | Intenta crear segundo WL con uno activo → error |
| should fail to create a week log without authentication | Sin cookie → error de autenticación |

### find-all.spec.ts
| Test | Descripción |
|------|-------------|
| should return all completed week logs | Tras crear/completar 2 WL, verifica que `findAll` retorne ambos |

### find-one.spec.ts
| Test | Descripción |
|------|-------------|
| should return a specific week log by ID | Crea WL, busca por ID, verifica estructura completa |

### update-week-log.spec.ts
| Test | Descripción |
|------|-------------|
| Debería actualizar metadata del WeekLog | Cambia notes, verifica persistencia |
| Debería completar un WeekLog (completed=true) | Marca como completado, verifica active=false |
| Debería activar un WeekLog (active=true) | Activa WL, verifica que otros se desactivan |
| Debería actualizar días via updateWeekLog | Actualiza ejercicios de un día específico |

### update-day-log.spec.ts
Mutation `updateDay` — operación unificada para WS/ES dentro de un día:

| Test | Descripción |
|------|-------------|
| should update a workout session in a week-log day via updateDay | Crea WS con ejercicios personalizados |
| should replace an existing workout session with different exercises via updateDay | Reemplaza ejercicios manteniendo mismo WS ID |
| should set a day as rest day via updateDay | Marca día como descanso, limpia WS si existe |
| should update workout session and add extra session to a day via updateDay | Combina actualización de WS + creación de ES en una sola mutation |

### update-day-workout-status.spec.ts
| Test | Descripción |
|------|-------------|
| Should toggle day to rest | Marca día como rest, verifica WS eliminado |
| Should toggle day back to training | Desmarca rest, verifica nuevo WS creado |

### active-week.spec.ts
| Test | Descripción |
|------|-------------|
| should return active week when exists | Verifica `activeWeekLog` retorna semana activa |
| should return hasActiveWeek false when no active week | Sin WL activo, verifica `hasActiveWeek: false` |

### remove-week-log.spec.ts
| Test | Descripción |
|------|-------------|
| should remove a week log | Soft-delete (deleted=true), verifica ya no retorna en queries |

### repro-bug.spec.ts
Test para reproducción de bugs específicos (regression).

### assign-with-routine.spec.ts
| Test | Descripción |
|------|-------------|
| should assign a routine to a day | Asigna RoutineDay a día específico del WL activo |
| should replace an existing workout session when assigning a different routine | Reemplaza WS existente con nueva rutina |
| should assign routine to a rest day | Asigna rutina a día que era rest, verifica isRest=false |
| should fail to assign routine to a non-existent day | Fecha fuera del rango del WL → error |

### Extra Session Tests

#### add-extra-session.spec.ts
| Test | Descripción |
|------|-------------|
| should add an extra session to a day via updateDay | Agrega ES (running, 30min) a un día |
| should add multiple extra sessions to different days | Agrega ES a varios días |
| should add extra session to a rest day | ES en día de descanso |
| should validate extra session intensity range | intensityLevel fuera de 1-5 → error |

#### remove-extra-session.spec.ts
| Test | Descripción |
|------|-------------|
| should remove an extra session from a day | Elimina ES por ID, verifica que se quite del array |

#### update-extra-session.spec.ts
| Test | Descripción |
|------|-------------|
| should update an extra session | Cambia disciplina, duración, intensidad |

#### extra-session-catalog.spec.ts
Verifica el catálogo de disciplinas disponibles para ExtraSession.

---

## 9. Cómo Agregar un Nuevo Test E2E

1. Crear archivo en `test/e2e/<area>/<nombre>.spec.ts`
2. Seguir la estructura:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppTestModule } from '../../utils/app-test.module';
import { closeInMongodConnection, clearDatabase } from '../../utils/db-handler';
import { UserService } from '../../../src/modules/user/user.service';
import { createTestUser, getTestUserCredentials } from '../../fixtures/user.fixture';
import { getCookieWithToken } from '../helpers/week-log.helper';
import cookieParser from 'cookie-parser';

describe('Mi Nuevo Test (e2e)', () => {
  let app: INestApplication;
  let userService: UserService;
  let authCookie: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppTestModule],
    }).compile();
    app = module.createNestApplication();
    userService = module.get<UserService>(UserService);
    app.use(cookieParser());
    await app.init();
  });

  beforeEach(async () => {
    await clearDatabase();
    await createTestUser(userService);
    // Login para obtener cookie
    const loginRes = await request(app.getHttpServer()).post('/graphql')
      .send({ query: `mutation { login(identifier: "${getTestUserCredentials().identifier}", password: "${getTestUserCredentials().password}") }` });
    authCookie = getCookieWithToken(loginRes);
  });

  afterAll(async () => {
    await closeInMongodConnection();
    await app.close();
  });

  it('should do something', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({ query: `...` });
    expect(res.status).toBe(200);
  });
});
```

### Convenciones
- Usar `clearDatabase()` en `beforeEach` para aislamiento — los tests NUNCA
  deben depender de estado de otros runs
- Usar `createTestUser()` + login con `getCookieWithToken()` en cada test
- Usar `getActiveWeekLog()` helper para verificar estado
- Para tests de week-log, cerrar semana activa existente antes de crear una nueva
- GraphQL queries como constantes con template literals
- Verificar siempre `response.body.errors` ante fallos

---

## 10. Lecciones Aprendidas (para agentes futuros)

Errores reales encontrados al reparar esta suite — evitar repetirlos:

1. **Tokens de modelo**: usar siempre `getModelToken(<Clase>.name)` porque así
   lo registra `MongooseModule.forFeature({ name: X.name })`. El objeto
   `XSchema` de SchemaFactory NO sirve para derivar el token.
2. **IDs en mocks**: los servicios modernos convierten a `ObjectId`; al
   asertar, capturar los argumentos recibidos y comparar `.toString()`, o
   proveer `_id` además de `id` en los objetos mockeados cuando el resolver
   llama `result._id.toString()`.
3. **Comportamiento evolucionado ≠ bug**: antes de "arreglar" un test que
   falla, verificar qué hace HOY el servicio/resolver. Varios tests viejos
   asumían contratos superados (ej.: NotFound al crear ExtraSession sin WS,
   cuando ahora auto-crea).
4. **Deps nuevas rompen specs viejos**: cada vez que se agrega una dependencia
   a un constructor (StorageService, EventEmitter2, use cases), buscar los
   `.spec.ts` afectados y actualizar providers.
5. **Ejecutar siempre**: `npm run lint` + build + ambas suites después de
   cambios masivos en specs.
