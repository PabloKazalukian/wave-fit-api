# User Profile Module - Bounded Contexts

> Part of the stable module documentation. Specs live under `sdd/`; this document describes the implemented system state.
> **Status:** Current
> **Last updated:** 2026-09-12

## Structure

```
src/modules/user/user-profile/
├── user-profile.module.ts      <- Module registering schemas and providers
├── index.ts                     <- Barrel export
├── user-profile.service.ts      <- Base profile + context aggregation + non-migrated domains
├── user-profile.resolver.ts     <- Queries/Mutations of the base profile (guard-based auth)
├── user-profile.utils.ts        <- extractUserId, Epley, BMR, buildUserContextForAI()
│
├── goals/                       <- Bounded context: goals
│   ├── goals.resolver.ts        <- updateUserGoals, userGoals
│   ├── goals.service.ts         <- Exclusive access to UserGoal
│   └── dto/update-goals.input.ts
│
├── training-preference/         <- Bounded context: training preferences
│   ├── training-preference.resolver.ts  <- updateUserTrainingPreference, userTrainingPreference
│   ├── training-preference.service.ts   <- Exclusive access to UserTrainingPreference
│   └── dto/update-training-preference.input.ts
│
├── weight/                      <- Bounded context: weight history
│   ├── weight.resolver.ts       <- createWeightLog, userWeightLogs
│   ├── weight.service.ts        <- Exclusive access to UserWeightLog
│   └── dto/create-weight-log.input.ts
│
├── entities/
│   └── *.entity.ts              <- GraphQL ObjectType (output) - shared
├── dto/                         <- DTOs of the base profile and not-yet-migrated domains
└── schema/
    ├── user-profile.schema.ts         <- Base biometrics
    ├── goals.schema.ts                <- Active goal
    ├── strength-metrics.schema.ts     <- 1RM per exercise
    ├── resourse.schema.ts             <- Available equipment
    ├── schedule.schema.ts             <- Weekly availability
    ├── health-constraints.schema.ts   <- Injuries / limitations
    ├── training-performance.schema.ts <- Style and preferences
    └── weight.schema.ts               <- Weight history
```

## Architecture

- **UserProfileService** keeps the CRUD of the base profile plus health-constraints, schedule, resource and strength-metrics, and `getFullProfileContext()` (a cross-domain aggregation that delegates to the specialized services).
- **Specialized services** (`GoalsService`, `TrainingPreferenceService`, `WeightService`): single source of access to their collection.
- Mongoose schemas and GraphQL entities live at the same level because they are shared between the aggregate context and the bounded contexts.
- The pending-migration contexts (schedule, health-constraints, resource, strength-metrics) are still served by `UserProfileService`.

## GraphQL endpoints

| Query/Mutation | Description | Resolver |
|---|---|---|
| `createUserProfile(input)` | Create biometric profile (1 per user) | UserProfileResolver |
| `userProfiles` | List all profiles (admin) | UserProfileResolver |
| `userProfile(id)` | Find profile by ID | UserProfileResolver |
| `myProfile` | Profile of the authenticated user | UserProfileResolver |
| `userProfileContext` | Full profile context | UserProfileResolver |
| `updateUserProfile(input)` | Update profile | UserProfileResolver |
| `upsertUserProfile(input)` | Create or update if it already exists | UserProfileResolver |
| `removeUserProfile(id)` | Delete profile | UserProfileResolver |
| `removeMyProfileData` | Delete authenticated user profile data | UserProfileResolver |
| `updateUserGoals(input)` | Upsert goals | GoalsResolver |
| `userGoals` | User goals | GoalsResolver |
| `updateUserTrainingPreference(i)` | Upsert preferences | TrainingPreferenceResolver |
| `userTrainingPreference` | User preferences | TrainingPreferenceResolver |
| `createWeightLog(input)` | Register weight | WeightResolver |
| `userWeightLogs` | Weight history | WeightResolver |

Operations of the pending-migration contexts served by `UserProfileService` on the same module surface: `updateUserSchedule`/`userSchedule`, `updateUserHealthConstraints`/`userHealthConstraints`, `updateUserResource`/`userResource`, `createUserStrengthMetric`/`userStrengthMetrics`/`removeUserStrengthMetric`, `toggleFavoriteExercise`/`toggleFavoriteRoutine`/`toggleFavoriteRoutineDay`.

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

- Migrate the remaining domains to the bounded-context pattern: health-constraints, schedule, resource, strength-metrics
- Unit tests with real cases (Mongoose mocks)
- E2E tests of the endpoints