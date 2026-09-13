# Engineering Architecture

> **Status:** Current
> **Last updated:** 2026-09-13

Stable, high-level architecture of the WaveFit API. This document describes how the system is built and how the pieces relate to each other. It deliberately avoids feature-specific implementation plans and spec content; those live in the corresponding specs (`sdd/`) and reference documents.

Source of truth for the module catalog is this document together with `documents/modules/`. Detailed reference documents are listed at the end of this document.

## 1. Architectural Style

| Concern | Choice |
|---|---|
| Language / runtime | TypeScript on Node.js |
| Backend framework | NestJS 11 |
| API | GraphQL (Apollo via `@nestjs/graphql` + `@nestjs/apollo`) |
| Persistence | MongoDB via Mongoose (OOM) |
| Auth | JWT in HttpOnly cookie + Google OAuth (PKCE) |
| Event bus | `@nestjs/event-emitter` (`EventEmitter2`) |
| File storage | AWS SDK S3 (avatars) |

- The GraphQL schema is auto-generated from code (`autoSchemaFile`), not hand-written SDL.
- Playground is enabled in development.
- DTO validation uses `class-validator` and `class-transformer`.
- The GraphQL context exposes `{ req, res }` to every resolver.

## 2. Layered Flow: Resolver → Service → Schema

Most modules follow the classic NestJS three-layer pattern:

```
Resolver (GraphQL) → Service (business logic) → Schema (Mongoose model)
                           │
                      AuditLogs (interceptor, cross-cutting)
```

| Layer | Responsibility | Example |
|---|---|---|
| **Resolver** | GraphQL queries/mutations | `auth.resolver.ts` |
| **Service** | Business logic | `user.service.ts` |
| **Schema** | Mongoose model | `user.schema.ts` |
| **DTO / Input** | Input validation | `create-user.input.ts` |

All writes flow through the resolver into a service; the `AuditInterceptor` (`src/modules/audit-logs/audit-logs.interceptor.ts`) sits on mutated operations and records a before/after audit entry in the `AuditLogs` collection.

## 3. Hexagonal Architecture for Complex Tracking Modules

The complex tracking modules (week-log, day-log) do not use the classic three-layer pattern. They use a four-layer hexagonal architecture with dependency inversion:

| Layer | Directory | Responsibility | Depends on |
|---|---|---|---|
| **Presentation** | `presentation/` | GraphQL DTOs, output entities | — |
| **Application** | `application/use-cases/` | Use cases, validators | Domain (interface) |
| **Domain** | `domain/` | Domain entities, repository interfaces | — |
| **Infrastructure** | `infrastructure/` | Mongoose schemas, repository implementation | Domain (interface) |

Dependency direction:

```
Resolver → Service → UseCase → Domain (interface) ← Infrastructure (implementation)
```

The service delegates to use cases (each exposing `execute()`); the use cases depend only on a repository interface defined in the domain layer; the infrastructure layer implements that interface against Mongoose.

Module state:

| Module | State | Layers implemented |
|---|---|---|
| week-log | Complete | presentation, application (11 use cases), domain, infrastructure |
| day-log | Complete | presentation, application (10 use cases), domain, infrastructure |
| Rest of modules | Classic pattern | Resolver → Service → Schema |

`ActiveTrackingService` (`activeTracking` query, phases of day-log) coordinates week-log/day-log state without direct coupling between the two modules.

## 4. Module Structure Overview

```
src/modules/
├── auth/                    # JWT + Google OAuth
├── user/                    # User management (+ avatar via StorageService)
│   └── user-profile/        # Bounded contexts: goals, training-preference,
│                            #   weight, schedule, health-constraints,
│                            #   resource, strength-metrics
├── storage/                 # S3 utility (uploadFile/deleteFile) for avatars
├── routines/
│   ├── templates/           # exercise, routine-day, routine-plan
│   └── tracking/            # workout-session, week-log, day-log,
│                            #   extra-session, training-history
├── ai/                      # LLM providers (Groq), rate limit, retry/backoff
├── training-plan/           # AI-generated training plans (generatePlan/confirmPlan)
├── stats/                   # Metrics and statistics (experimental, hexagonal,
│                            #   outside the test suite)
└── audit-logs/              # DB change registration

src/common/common.resolver.ts  # Query `warmup` (anti-sleep ping)
```

A shared `src/database/` area holds the autoseeding infrastructure (`seed-runner.ts`, `seed.module.ts`, `seeds/`) and one-off DB scripts/migrations.

## 5. Auth Architecture

- **Token in cookie:** the JWT travels in an HttpOnly cookie named `token`. Clients never access the token (mitigates XSS); no `Authorization: Bearer` header is used.
- **Extraction:** the `JwtStrategy` reads the token from the cookie.
- **Protection:** resolvers are guarded with `@UseGuards(GqlAuthGuard)` and receive the authenticated user via `@Context()` (`context.req.user`).
- **Login flows:**
  1. Email/password: `AuthResolver.login` validates with bcrypt, issues JWT, sets the cookie.
  2. Google OAuth (PKCE): `GoogleResolver.loginWithGoogle` exchanges `code` + `codeVerifier`, links/creates the user, issues JWT, sets the cookie.
- **Logout** clears the cookie.

Cookie attributes:

| Attribute | Development | Production |
|---|---|---|
| HttpOnly | true | true |
| Secure | false | true |
| SameSite | lax | none |
| MaxAge | 7 days | 7 days |

## 6. GraphQL API Surface (Summary)

Global / Common:

- `warmup` → String (anti-sleep ping)

Auth: `login`, `logout`, `me`, `loginWithGoogle`

User: `createUser`, `users`, `user`, `userName`, `userEmail`, `updateUser`, `removeUser`, `isEmailAvailable`, `updateAvatar`

UserProfile and sub-resources:

- Profile: `myProfile`, `userProfile`, `userProfileContext`, `userProfiles`, `upsertUserProfile`, `createUserProfile`, `updateUserProfile`, `removeUserProfile`, `removeMyProfileData`
- Goals / schedule / health-constraints / resource / training-preference / strength-metrics / weight: `updateUserGoals`, `userGoals`, `updateUserSchedule`, `userSchedule`, and the analogous pairs for the other sub-modules, plus `toggleFavoriteExercise` / `toggleFavoriteRoutine` / `toggleFavoriteRoutineDay`, `createUserStrengthMetric`, `userStrengthMetrics`, `removeUserStrengthMetric`, `createWeightLog`, `userWeightLogs`

Routines templates:

- Exercise: `createExercise`, `exercises`, `exercise`, `updateExercise`, `removeExercise`
- RoutinePlan: `createRoutinePlan`, `routinePlans`, `routinePlan`, `updateRoutinePlan`, `removeRoutinePlan`, `isRoutineTitleAvailable`
- RoutineDay: `createRoutineDay`, `routineDays`, `routineDay`, `updateRoutineDay`, `removeRoutineDay`, `routinesByCategory`, `createRoutineByWorkout`

Tracking:

- WorkoutSession: `createWorkoutSession`, `workoutSessionFindAll`, `workoutSessionFindOne`, `workoutSessionByDate`, `updateWorkoutSession`, `removeWorkoutSession`
- WeekLog: `createWeekLog`, `findAll`, `findOne`, `activeWeekLog`, `currentWorkoutSession`, `updateWeekDay`, `updateWeekDayWorkoutStatus`, `updateWeekLog`, `assignRoutineToWeekDay`, `removeWorkoutSessionFromWeekDay`, `removeExtraSessionFromWeekDay`, `syncWeekLogDays`, `removeWeekLog`
- DayLog: `createDayLog`, `dayLogFindAll`, `dayLogFindOne`, `activeDayLog`, `updateDayLog`, `updateDayLogStatus`, `assignRoutineToDayLog`, `removeWorkoutSessionFromDayLog`, `removeExtraSessionFromDayLog`, `removeDayLog`
- ActiveTracking: `activeTracking` → `ActiveTracking` (`hasActive`, `type WEEK_LOG|DAY_LOG`, `week?`, `day?`)
- ExtraSession: `extraSessionCatalog`, `createExtraSession`, `extraSessionFindAll`, `extraSessionFindOne`, `extraSessionsByIds`, `extraSessionsByWorkoutSession`, `updateExtraSession`, `removeExtraSession` → Boolean
- TrainingHistory: `trainingCalendar`

AI and TrainingPlan:

- `aiUsageStatus`
- `generatePlan`, `modifyPlan`, `confirmPlan`, `trainingPlans`, `trainingPlan`, `updateTrainingPlan`, `removeTrainingPlan` (all `GqlAuthGuard`-protected)

Stats (experimental; `GqlAuthGuard` for read queries, `ServiceAuthGuard` for worker operations):

- `getTopExercises`, `getTopRoutines`, `getPersonalRecords`, `getAdherence`
- `getRawDataForWorker`, `saveTopExercises`, `saveTopRoutines`, `savePersonalRecords`, `saveAdherence`

AuditLogs: `auditLogs`, `userAuditLogs`

> The `findAll`/`findOne` operations of workout-session, extra-session and day-log were renamed with `name` overrides (`workoutSessionFindAll/FindOne`, `extraSessionFindAll/FindOne`, `dayLogFindAll/FindOne`) to avoid GraphQL schema collisions.

## 7. Autoseeding

On app bootstrap, `SeedService` (`src/database/seed-runner.ts`, implements `OnApplicationBootstrap`) seeds the database when it is empty: the exercise catalog, six PPL routine days and the default PPL routine plan. Seeding is idempotent — every step first verifies existing data. See `documents/engineering/seed.md` for the full architecture and seeded data detail.

## 8. Audit-Logs Interceptor Pattern

`AuditLogsModule` provides a cross-cutting `AuditInterceptor`:

- Resolver operations are decorated with `@Audit({ action, entity })` metadata (`src/modules/audit-logs/audit-logs.decorator.ts`).
- The interceptor reads the metadata via `Reflector` and, when present, writes an `AuditLogs` entry around the operation:
  - On success (`tap`): records `success: true`, the resolved entity id, user identity and the IP.
  - On failure (`catchError`): records `success: false`, the error message/stack, then re-throws the original error.
- It resolves GraphQL context via `GqlExecutionContext.create(context)` and extracts user identity from `ctx.req.user`, `ctx.user`, or the custom `x-user-id`/`x-user-email` headers (fallback: anonymous).
- AI operations reuse the same collection directly from `AiService` and the training-plan services (actions `AI_PROMPT_EXECUTED`, `TRAINING_PLAN_GENERATED`, `TRAINING_PLAN_CONFIRMED`), not through the interceptor.

## 9. Reference Documents

| Topic | Document |
|---|---|
| Environment variables | `AGENTS.md` |
| Authentication | `documents/modules/auth.md` + ADR-0001 / ADR-0005 |
| Seeding | `documents/engineering/seed.md` |
| AI module | `documents/modules/ai.md` + ADR-0006 |
| TrainingPlan module | `documents/modules/training-plan.md` + `sdd/training-plan.spec.md` |
| UserProfile module | `documents/modules/user-profile.md` |
| Stats module | `documents/modules/stats.md` + ADR-0007 |
| Testing | `documents/engineering/testing.md` |
| Coding standards | `documents/engineering/coding-standards.md` |