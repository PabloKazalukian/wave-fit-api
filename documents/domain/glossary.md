> **Status:** Current
> **Last updated:** 2026-09-12

# Domain Glossary

Canonical vocabulary of the WaveFit domain. Code identifiers, paths, model and enum names are kept exactly as they appear in the sources. Where historical documents used different names, the canonical names in this table are preferred.

## Canonical terms

| Term | Definition |
|---|---|
| `Exercise` | Catalog of exercises used to build routines. Stored with a `normalizedName` for normalized searches; similar names are rejected on create/update with Levenshtein distance (`isSimilar()`). |
| `RoutineDay` | One training day. A component of a `RoutinePlan` in the Template branch. |
| `RoutinePlan` | A weekly plan template that contains `RoutineDay`s. Since the AI is implemented, template plans created from an AI plan carry `isAiGenerated: true`. |
| `WorkoutSession` | A completed training session; the unit of tracking attached to a week day inside a `WeekLog` or to a `DayLog`. |
| `WeekLog` | The weekly tracking summary. It contains and manages `WorkoutSession` and `ExtraSession` as sub-resources in its `days[]` array. |
| `ExtraSession` | An additional session performed outside the plan; attachable to week days and to a `DayLog`. |
| `DayLog` | A standalone training day without a week, for ad-hoc training. It cannot coexist with an active `WeekLog`. |
| `ActiveTracking` | Unified read concept over the active tracker. The `activeTracking` query returns `hasActive`, `type` (`WEEK_LOG` \| `DAY_LOG`), and optionally the active `week` or `day`. |
| Template | The planned-definitions branch of the domain: `Exercise`, `RoutineDay`, and `RoutinePlan`. |
| Tracking | The execution branch of the domain: `WorkoutSession`, `WeekLog`, `ExtraSession`, and `DayLog`. |
| `TrainingPlan` | AI-only plan aggregate. Created exclusively through `generatePlan`; persists a `draft` with `confirmed: false` until `confirmPlan` materializes it. There is no manual creation route. |
| `aiSnapshot` | Embedded field of a `TrainingPlan` (schema `AiSnapshot`) that records what was sent to the AI and what was resolved: `contextSentToAI`, `promptUsed`, `modelUsed`, `rawResponse`, `tokensUsed`, `generatedAt`. It is the source of truth used to re-materialize at confirmation time. |
| `PlanFocus` | Objective focus of a generated plan. Values: `fat_loss` \| `muscle_gain` \| `strength` \| `endurance` \| `maintenance` \| `recomp`. Legacy values (`hypertrophy`, `sport_specific`, `general`) are normalized on read. |
| `PlanConfirmationAction` | Action performed by `confirmPlan`. Values: `create_week_log` (WeekLog plus sessions), `create_routine_plan` (template RoutinePlan), and `adapt_active_week` (reserved, returns 501). |
| `Goal` | Snapshot of the objective context persisted (`GoalModel.create({ contextSnapshot })`) before calling the AI, for auditability. Name is shared between the user-profile `goals` bounded context and the AI snapshot model. |
| `distributionDays` | User-profile preference for the tracking type: `week_log` (default) \| `day_log`. It is a soft gate: it suggests the default type in the frontend but does not block creation of the other type. |
| `normalizedName` | Normalized form of an exercise name used for normalized searches (`normalizeString`). |
| `AuditLog` | Record of changes in the database, produced by the audit interceptor, plus AI actions (`AI_PROMPT_EXECUTED`, `TRAINING_PLAN_GENERATED`, `TRAINING_PLAN_CONFIRMED`). |
| `GqlAuthGuard` | Guard that protects GraphQL resolvers. It validates the JWT extracted from the `token` cookie and attaches the user to `req.user`. |
| `token` cookie | HttpOnly cookie that transports the JWT. The client never has programmatic access to it. |
| PKCE | Proof Key for Code Exchange, used by the Google OAuth flow: the frontend sends a `code` and a `codeVerifier` to `loginWithGoogle`; the backend exchanges them with Google and issues a local JWT. |
| `ServiceAuthGuard` | Guard used by the stats module for worker (service) calls that authenticate with a service JWT (`role: SERVICE`, scopes `stats:read` / `stats:write`). |
| `AI_CAUSE` | Error taxonomy of the AI module: `AI_PROVIDER_ERROR`, `AI_MALFORMED_JSON`, `AI_EMPTY_RESPONSE`, `AI_UNKNOWN_EXERCISE_NAME`, `RATE_LIMIT_EXCEEDED`. |

## Terminology resolution

- Prefer `TrainingPlan` for the AI-generated plan and `RoutinePlan` for the template; they are different aggregates that are both "plans" in natural language.
- Prefer `WorkoutSession` over synonyms such as "training session" or "workout" in technical contexts.
- Prefer `WeekLog` for the weekly aggregate; `DayLog` is the standalone-day variant and is not a week.
- `distributionDays` is normalized to lowercase enum values `week_log` / `day_log`; legacy values (`'Week-log'`, `'Day-log'`, `'WEKK'`, `'DAY'`) are normalized once at bootstrap.
- GraphQL find-all/find-one operations of the tracking modules were renamed to `workoutSessionFindAll`/`workoutSessionFindOne`, `extraSessionFindAll`/`extraSessionFindOne`, and `dayLogFindAll`/`dayLogFindOne` to avoid collisions in the schema.