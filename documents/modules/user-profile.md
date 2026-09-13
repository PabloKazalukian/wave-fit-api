# User Profile Module - Bounded Contexts

> Part of the stable module documentation. Specs live under `sdd/`; this document describes the implemented system state.
> **Status:** Current
> **Last updated:** 2026-09-13

## Structure

```
src/modules/user/user-profile/
├── user-profile.module.ts      <- Module registering schemas and providers
├── index.ts                     <- Barrel export
├── user-profile.service.ts      <- Base profile + full-context aggregation + removeMyProfileData
├── user-profile.resolver.ts     <- Queries/Mutations of the base profile (guard-based auth)
├── user-profile.utils.ts        <- extractUserId, Epley, BMR, buildUserContextForAI()
│
├── goals/                       <- Bounded context: goals
│   ├── goals.resolver.ts        <- updateUserGoals, userGoals
│   ├── goals.service.ts         <- Exclusive access to UserGoal
│   └── dto/update-goals.input.ts
│
├── training-preference/         <- Bounded context: training preferences
│   ├── training-preference.resolver.ts  <- updateUserTrainingPreference, userTrainingPreference,
│   │                              toggleFavoriteExercise / toggleFavoriteRoutine / toggleFavoriteRoutineDay
│   ├── training-preference.service.ts   <- Exclusive access to UserTrainingPreference
│   └── dto/update-training-preference.input.ts
│
├── weight/                      <- Bounded context: weight history
│   ├── weight.resolver.ts       <- createWeightLog, userWeightLogs
│   ├── weight.service.ts        <- Exclusive access to UserWeightLog
│   └── dto/create-weight-log.input.ts
│
├── health-constraints/          <- Bounded context: health constraints
│   ├── health-constraints.resolver.ts   <- updateUserHealthConstraints, userHealthConstraints
│   ├── health-constraints.service.ts    <- Exclusive access to UserHealthConstraint
│   └── dto/update-health-constraints.input.ts
│
├── schedule/                    <- Bounded context: schedule
│   ├── schedule.resolver.ts     <- updateUserSchedule, userSchedule
│   ├── schedule.service.ts      <- Exclusive access to UserSchedule
│   └── dto/update-schedule.input.ts
│
├── resource/                    <- Bounded context: resource/equipment
│   ├── resource.resolver.ts     <- updateUserResource, userResource
│   ├── resource.service.ts      <- Exclusive access to UserResource
│   └── dto/update-resource.input.ts
│
├── strength-metrics/            <- Bounded context: strength metrics
│   ├── strength-metrics.resolver.ts     <- createUserStrengthMetric, userStrengthMetrics,
│   │                              removeUserStrengthMetric
│   ├── strength-metrics.service.ts      <- Exclusive access to UserStrengthMetric
│   └── dto/create-strength-metric.input.ts
│
├── entities/
│   └── *.entity.ts              <- GraphQL ObjectType (output) - shared
├── dto/                         <- DTOs of the base profile
└── schema/
    ├── user-profile.schema.ts         <- Base biometrics (incl. distributionDays)
    ├── goals.schema.ts                <- Active goal
    ├── strength-metrics.schema.ts     <- 1RM per exercise
    ├── resourse.schema.ts             <- Available equipment (filename preserves the original typo)
    ├── schedule.schema.ts             <- Weekly availability
    ├── health-constraints.schema.ts   <- Injuries / limitations
    ├── training-preference.schema.ts  <- Style and preferences
    └── weight.schema.ts               <- Weight history
```

## Architecture

- **UserProfileService** keeps the CRUD of the base profile and the cross-domain aggregations: `getFullProfileContext()` and `getFullLlmContext()` (both delegate to the specialized services), plus `removeAllProfileData()`.
- **Specialized services** (one per bounded context): `GoalsService`, `TrainingPreferenceService`, `WeightService`, `HealthConstraintsService`, `ScheduleService`, `ResourceService`, `StrengthMetricsService`. Each is the single source of access to its collection and is backed by its own resolver.
- Mongoose schemas and GraphQL entities live at the same level because they are shared between the aggregate context and the bounded contexts.
- All contexts already follow the bounded-context pattern (each with resolver + service + dto). `UserProfileService` no longer serves CRUD of the sub-domains; it only aggregates them.

## GraphQL endpoints

| Query/Mutation | Description | Resolver |
|---|---|---|
| `createUserProfile(input)` | Create biometric profile (1 per user) | UserProfileResolver |
| `userProfiles` | List all profiles (any authenticated user; no admin-only gate) | UserProfileResolver |
| `userProfile(id)` | Find profile by ID (scoped to the owner) | UserProfileResolver |
| `myProfile` | Profile of the authenticated user | UserProfileResolver |
| `userProfileContext` | Full profile context (8 sub-docs) | UserProfileResolver |
| `updateUserProfile(input)` | Update profile | UserProfileResolver |
| `upsertUserProfile(input)` | Create or update if it already exists | UserProfileResolver |
| `removeUserProfile(id)` | Delete profile | UserProfileResolver |
| `removeMyProfileData` | Delete authenticated user profile data (all contexts, idempotent) | UserProfileResolver |
| `updateUserGoals(input)` | Upsert goals | GoalsResolver |
| `userGoals` | User goals | GoalsResolver |
| `updateUserTrainingPreference(i)` | Upsert preferences | TrainingPreferenceResolver |
| `userTrainingPreference` | User preferences | TrainingPreferenceResolver |
| `toggleFavoriteExercise(id)` | Toggle favorite exercise | TrainingPreferenceResolver |
| `toggleFavoriteRoutine(id)` | Toggle favorite routine plan | TrainingPreferenceResolver |
| `toggleFavoriteRoutineDay(id)` | Toggle favorite routine day | TrainingPreferenceResolver |
| `createWeightLog(input)` | Register weight | WeightResolver |
| `userWeightLogs` | Weight history | WeightResolver |
| `updateUserSchedule(input)` / `userSchedule` | Schedule | ScheduleResolver |
| `updateUserHealthConstraints(input)` / `userHealthConstraints` | Health constraints | HealthConstraintsResolver |
| `updateUserResource(input)` / `userResource` | Resource / equipment | ResourceResolver |
| `createUserStrengthMetric(input)` / `userStrengthMetrics` / `removeUserStrengthMetric(id)` | Strength metrics | StrengthMetricsResolver |

### `distributionDays` field (week / loose-day preference)

- Normalized enum: `week_log` (week) | `day_log` (loose day). Default: `week_log`.
- Exposed on the GraphQL entity `UserProfile` and in `create/updateUserProfile` (optional).
- **Soft gate**: only suggests the default type on the frontend; it does **not block** creating the other type.
- **One-time backfill** at startup (`UserProfileService.onApplicationBootstrap`): normalizes legacy values (`'Week-log'`/`'Day-log'`/`WEKK`/`DAY`) to the normalized values. Idempotent.
- Included in the AI context (`buildUserContextForAI` will include `ctx.distributionDays`).

## Utilities (`user-profile.utils.ts`)

- `extractUserId(context)` - validates and extracts the userId from the JWT context
- `estimateOneRm(weightKg, reps)` - Epley formula: `1RM = w * (1 + r/30)`
- `bmrMifflinStJeor(weightKg, heightCm, ageYears, sex)` - basal metabolic rate
- `buildUserContextForAI(data)` - builds a unified object with all the profile data to send to an AI assistant

## Pending / Next steps

- E2E tests of the endpoints (unit specs exist for every service and resolver; the "Mongoose mocks" unit tests are already in place)
- Rename `resourse.schema.ts` to `resource.schema.ts` (filename keeps a typo today)
- Deduplicate `extractUserId`: `user-profile.utils.ts` and `common/utils/user-id.utils.ts` implement the same helper