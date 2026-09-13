# Plans

## What is a Plan?

A **Plan** is a temporary execution artifact for implementation guidance. It organizes the work into tasks and phases, records design decisions and user-confirmed choices, provides task traceability, and serves as a historical record for later review.

## Plans are NEVER Authoritative

Plans are **never authoritative**. The two authoritative sources are:

1. **Specs** (`sdd/`): the normative contract for a feature (requirements, architecture, files, tests, acceptance criteria).
2. **Code**: the actual implementation as it exists in the repository.

If a Plan conflicts with a Spec or with the code, the Spec and the code win. A Plan is a snapshot of intent at a given point in time; it does not need to be kept in sync once the feature is done. That is why a **completed** plan must be marked with `Status: Historical / Non-Authoritative`.

## Convention

Each feature has its own folder with a single plan file:

```
documents/plans/<feature>/plan.md
```

## Status lifecycle

| Status | Meaning |
|--------|---------|
| **In Progress** | The plan describes work currently being executed. |
| **Active / Pending** | The feature is planned but not yet implemented; the plan remains useful guidance for a future execution. |
| **Historical / Non-Authoritative** | The feature was implemented (or superseded); the plan is kept only for traceability and historical review. The authoritative source of truth is the Spec and the Code. |

## Index

| Feature | Folder | Status |
|---------|--------|--------|
| Day-Log (tracking) | `documents/plans/day-log/plan.md` | Historical |
| TrainingPlan module update (IA) | `documents/plans/training-plan-update/plan.md` | Historical |
| AI idempotency + rate limit + retry | `documents/plans/ai-idempotency-retry/plan.md` | Historical |
| GraphQL name collisions in tracking | `documents/plans/graphql-collisions/plan.md` | Historical |
| Modify AI-generated plan (`modifyPlan`) | `documents/plans/modify-plan/plan.md` | Historical |
| Stats DLQ via Audit-Logs | `documents/plans/stats-dlq/plan.md` | Active / Pending |
| Documentation migration to Spec-Anchored Development | `documents/plans/docs-migration/plan.md` | Historical |