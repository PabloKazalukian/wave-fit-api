> **Status:** Current
> **Last updated:** 2026-09-12

# WaveFit Domain Overview

## What WaveFit is

WaveFit is a companion for personal training. The API is the backend (NestJS 11, GraphQL with Apollo, MongoDB with Mongoose) of a two-repository product whose frontend is an Angular 20 application. It covers the full training lifecycle of a user:

- Managing a personalized exercise catalog (`Exercise`).
- Planning training weeks (`RoutinePlan` → `RoutineDay`) built from that catalog.
- Tracking what the user actually trains (`WorkoutSession`, `WeekLog`, `ExtraSession`, `DayLog`).
- Keeping a user profile that feeds context into planning and into the AI (`UserProfile` and its sub-contexts).
- Generating personalized training plans with an LLM (`TrainingPlan`).
- Recording changes to the database for auditability (`AuditLogs`).

The domain is organized into two branches: **Template** (what is planned) and **Tracking** (what is executed). Around them sit supporting aggregates: the user profile, AI-generated plans, and stats.

## Authentication model

Users authenticate with a JWT carried in an HttpOnly cookie named `token`; the client never has programmatic access to the token. Two login paths exist: email/password (`login`) and Google OAuth with PKCE (`loginWithGoogle`). Resolvers that require a user are protected with `GqlAuthGuard`, which validates the token and attaches the user to the request context.

## Template branch (programmed routines)

The Template branch models the stable, reusable definitions used for planning:

| Model | Role |
|---|---|
| `Exercise` | Catalog of exercises. Each exercise is stored with a `normalizedName` for normalized searches, and similar names are detected on create/update via Levenshtein distance. |
| `RoutineDay` | One training day within a plan. Days can also be created directly from a workout. |
| `RoutinePlan` | A weekly plan; it contains `RoutineDay`s. A seeded PPL plan is inserted by default when the database is empty. |

A template represents what a user *should* do in a week, before considering what was actually executed.

## Tracking branch (what is executed)

The Tracking branch records what the user actually did:

| Model | Role |
|---|---|
| `WorkoutSession` | A completed training session. |
| `WeekLog` | The weekly tracking summary. It contains and manages `WorkoutSession` and `ExtraSession` as sub-resources in its `days[]` array. |
| `ExtraSession` | An additional session performed outside the plan, attachable to a week day (or to a `DayLog`). |
| `DayLog` | A standalone training day, without a week, for ad-hoc training outside the weekly plan. |

The central aggregate of tracking is the active `WeekLog`: a user typically has one active week, and each worked day inside it carries a `WorkoutSession`. An `ExtraSession` can be attached to any day. Because a `WeekLog` and a `DayLog` cannot be active at the same time, both aggregates coordinate through the `ActiveTracking` concept, and the unified `activeTracking` query tells the client which type is active (and its payload).

`trainingCalendar` offers a calendar view over the tracking history of the user.

## User profile and its bounded contexts

The `UserProfile` module holds the base biometric profile (birth date, height, weight) and organizes the rest of the profile data in bounded contexts, each with its own service (and its own resolver for `goals`, `training-preference`, and `weight`):

| Sub-context | Contents |
|---|---|
| `goals` | The active objective of the user. |
| `training-preference` | Training styles and preferences, plus favorites (exercises, routines, routine days). |
| `weight` | Weight history (`createWeightLog`, `userWeightLogs`). |
| `schedule` | Weekly availability. |
| `health-constraints` | Injuries and limitations. |
| `resource` | Available equipment and environment. |
| `strength-metrics` | Estimated 1RM per exercise. |

`userProfileContext` aggregates the full profile across all sub-contexts for consumption and for building the AI input (`buildUserContextForAI`). The profile also carries a `distributionDays` preference (`week_log` | `day_log`, default `week_log`) indicating whether the user prefers week-based or standalone-day tracking.

## AI-generated training plans

`TrainingPlan` is an AI-only aggregate: a plan is created exclusively through `generatePlan` and materialized into a real artifact through `confirmPlan` (a `WeekLog` plus its sessions, or a template `RoutinePlan`). The LLM returns exercise names (not IDs) for a 7-day plan. The backend validates the profile first, snapshots the objective (`Goal`), calls the LLM through the transversal `ai/` module (per-user rate limit plus retry/backoff), parses and validates the JSON, resolves names against the catalog, and persists the draft together with its `aiSnapshot`. The plan is only realized when the user confirms it.

## Stats and metrics

The `stats` module covers per-user metrics (top exercises, top routines, personal records, adherence). It is experimental and not active in production: NestJS never computes statistics itself. It publishes events to SQS, offers raw data to an external worker, and upserts the computed results back.

## Cross-cutting concerns

- **AuditLogs** — changes to the database (and AI actions) are recorded for auditability.
- **Ownership** — profile and tracking queries are scoped to the authenticated `userId`.
- **Soft delete** — tracking resources are flagged (`deleted`, `deletedAt`) rather than removed, and reads exclude them.