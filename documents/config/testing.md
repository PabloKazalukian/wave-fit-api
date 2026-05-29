# Tests E2E — Documentación

## 1. Vista General

17 spec files organizados en 2 áreas funcionales (auth + week-log), más infraestructura compartida.

```
test/
├── e2e/
│   ├── auth/
│   │   ├── login.spec.ts
│   │   ├── logout.spec.ts
│   │   └── me.spec.ts
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

**Comando:** `npm run test:e2e`

---

## 2. Infraestructura

### MongoDB en Memoria (`test/utils/db-handler.ts`)

Usa `mongodb-memory-server` para levantar una instancia MongoDB efímera:

- `rootMongooseTestModule()` — reemplaza `MongooseModule.forRoot()` por una conexión a MongoDB en memoria
- `closeInMongodConnection()` — desconecta y detiene el servidor (afterAll)
- `clearDatabase()` — limpia todas las colecciones entre tests (beforeEach)

### AppTestModule (`test/utils/app-test.module.ts`)

Módulo NestJS que replica la configuración real pero con:

- `MongooseModule` apuntando a MongoDB en memoria
- GraphQL playground deshabilitado
- Mismos módulos que la app real (User, Auth, WeekLog, Exercise, etc.)
- `GraphQLExceptionFilter` para capturar errores

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

## 3. Tests de Auth

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

## 4. Tests de WeekLog

### create-week-log.spec.ts (423 líneas)
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

### update-day-log.spec.ts (531 líneas)
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

### assign-with-routine.spec.ts (565 líneas)
| Test | Descripción |
|------|-------------|
| should assign a routine to a day | Asigna RoutineDay a día específico del WL activo |
| should replace an existing workout session when assigning a different routine | Reemplaza WS existente con nueva rutina |
| should assign routine to a rest day | Asigna rutina a día que era rest, verifica isRest=false |
| should fail to assign routine to a non-existent day | Fecha fuera del rango del WL → error |

### Extra Session Tests

#### add-extra-session.spec.ts (458 líneas)
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

## 5. Cómo Correr los Tests

```bash
# Todos los tests E2E
npm run test:e2e

# Tests de un archivo específico
npx jest test/e2e/auth/login.spec.ts --config jest-e2e.json

# Tests con cobertura
npm run test:cov
```

---

## 6. Cómo Agregar un Nuevo Test E2E

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
- Usar `clearDatabase()` en `beforeEach` para aislamiento
- Usar `createTestUser()` + login con `getCookieWithToken()` en cada test
- Usar `getActiveWeekLog()` helper para verificar estado
- Para tests de week-log, cerrar semana activa existente antes de crear una nueva
- GraphQL queries como constantes con template literals
- Verificar siempre `response.body.errors` ante fallos
