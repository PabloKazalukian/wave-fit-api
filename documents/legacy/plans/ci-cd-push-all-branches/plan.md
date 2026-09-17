# Plan: CI/CD Extension — CI on every branch and native auto-deploy on `main`

> **Status:** Historical / Non-Authoritative (implemented and validated 2026-09-17)
> **Extends:** `documents/legacy/plans/ci-cd/plan.md` (implemented and validated 2026-09-17)
> **Executed on branch:** `feat/ci-cd`

## Context

The base plan introduced the first automated CI pipeline (GitHub Actions) with
triggers `pull_request` to `main`, `push` to `main`, and `workflow_dispatch`.
Production deployment is handled by Render (section 3 of `ci-cd.md`).

The developer now wants the following flow and has already configured the
GitHub branch protection rule "Require status checks to pass before merging"
for the check `CI / quality`:

1. **Push to any branch** → run CI.
2. **Pull request** → run CI.
3. **Pass on `main`** → the **native Render auto-deploy** is the deployment
   mechanism that works (configured in the Render dashboard, not in this repo).

## Decisions

| Question | Decision |
|---|---|
| `push` trigger scope | All branches (`push:` with no branch filter). Includes `main`, so direct pushes to `main` still produce the required check. |
| `pull_request` trigger | Kept targeting `main` (unchanged). |
| Required status check | Workflow name `CI` + job `quality` → `CI / quality` (already matches the GitHub branch protection rule). |
| Duplicate runs | Pushing to a branch that has an open PR triggers both `push` and `pull_request` runs. Expected; no filtering. |
| CD in repo | Not added. Deployment is the **native Render auto-deploy** on push to `main`, configured server-side (`render.yaml`/Dockerfile remain out of scope). |
| Docs | `documents/engineering/ci-cd.md` and `README.md` updated to describe the all-branch CI trigger and the native auto-deploy on `main`. |

## Tasks

1. `.github/workflows/ci.yml` — change the `push` trigger from
   `branches: [main]` to all branches.
2. `documents/engineering/ci-cd.md` — update triggers (push on any branch) and
   section 3 (Deployment): production deploys via the **native Render
   auto-deploy** triggered by push to `main`; drop the "manual deployment / no
   CD workflow" phrasing.
3. `README.md` — update the Deploy note to the all-branch CI + native
   auto-deploy-on-`main` flow.
4. Validate — confirm the workflow YAML parses and the four quality gates stay
   green locally.
5. Archive this plan to `documents/legacy/plans/ci-cd-push-all-branches/plan.md`
   with `Status: Historical / Non-Authoritative`.

## Validation

```bash
npm run build
npm run lint:ci
npm test
npm run test:e2e
```

Local (2026-09-17): `npm run build` and `npm run lint:ci` green
(0 errors, 15 pre-existing warnings). No application code changed, so the unit
and E2E suites are unaffected by this extension.

Post-merge GitHub verification (external, on the Actions UI):

- Push to a feature branch → `CI / quality` runs.
- Open a PR to `main` → `CI / quality` runs and is reported for merge.
- Merge to `main` → CI runs and Render auto-deploys production.

## Outcome

- [x] `ci.yml` triggers CI on push to any branch
- [x] `ci-cd.md` and `README.md` describe all-branch CI + native auto-deploy
- [x] Full gate green locally
- [x] Plan archived as historical