# Engineering CI/CD

> **Status:** Current
> **Last updated:** 2026-10-01

## 1. Continuous Integration (GitHub Actions)

The repository runs an automated CI pipeline defined in
`.github/workflows/ci.yml`:

- **Triggers:** `pull_request` targeting `main`, `push` to **any branch**
  (including direct pushes to `main`), and manual `workflow_dispatch`. Pushing
  to a branch that has an open PR matches both the `push` and `pull_request`
  triggers, so two runs are expected in that case.
- **Runner:** a single `quality` job on `ubuntu-latest` with Node.js 22 and
  `npm ci` (the committed `package-lock.json` is the resolved dependency tree),
  with the npm download cache enabled.
- **Gate:** the four canonical commands run in sequence (`build` → `lint:ci` →
  `test` → `test:e2e`); the job fails on the first non-zero exit.
- **Concurrency:** superseded runs on the same ref are cancelled automatically.
- **Test environment:** the E2E/unit suites boot real NestJS modules whose
  providers validate env vars at construction time (`GoogleStrategy`,
  `GroqProvider`). Because CI has no `.env` file, the workflow supplies dummy,
  **non-secret** values (`GROQ_API_KEY`, `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`, `PREFERRED_AI_PROVIDER`). No production
  secret is ever required by the test suites.

A second, independent workflow — `.github/workflows/perf.yml` — covers the
performance layer. See section 5. It does **not** modify this gate.

CI is now the automated quality gate. A red pipeline blocks integration. There is
still **no CD**: deployment remains manual (section 3).

## 2. Quality Gates

The same four commands are the local gate and the CI gate:

| Command | Scope | Notes |
|---|---|---|
| `npm run build` | `tsc -p tsconfig.build.json` | TypeScript compile |
| `npm run lint:ci` | `eslint "src/**/*.ts"` | No `--fix`; read-only, CI-safe |
| `npm run lint` | `eslint "src/**/*.ts" --fix` | Local convenience; may rewrite files |
| `npm test` | Unit suite (`jest.config.js`) | `src/**/*.spec.ts` |
| `npm run test:e2e` | E2E suite (`test/jest-e2e.json --maxWorkers=2`) | `test/e2e/**` |

- CI uses `lint:ci` (no `--fix`) so a pipeline run never mutates the checkout.
- The unit and E2E suites are independent and both must be green.
- Coverage is informational (measured with `npm run test:cov:combined`) and is
  not a gate. See `documents/engineering/testing.md`.
- Environment variables for local development are documented and templated in
  the committed `.env.example` (never commit a real `.env`).

## 3. Deployment

- The application is deployed to **Render** (see README.md "Deploy: Render").
  Production deploys via the **native Render auto-deploy**: a push to `main`
  triggers the Render service to build and deploy. This is configured on the
  Render dashboard; there is no CD workflow in this repository.
- Production origins in the source confirm the Render deployment: the CORS origin
  `https://wave-fit-front.onrender.com` (`src/main.ts`) and the Google OAuth
  redirect `https://wave-fit-api.onrender.com` (`src/modules/auth/google/google.strategy.ts`).
- Required environment variables are listed in `.env.example` and described in
  `documents/modules/auth.md` and `documents/modules/ai.md`.

## 4. Performance Workflow (nightly, not a PR gate)

`.github/workflows/perf.yml` is a **separate** pipeline. It runs
`npx jest --config test/jest-perf.json --maxWorkers=1 --no-coverage`.

- **Triggers:** `schedule` (cron `0 3 * * 1-5`, weekdays at 03:00 UTC) and
  `workflow_dispatch` only. There is deliberately **no** `pull_request` and no
  `push` trigger, so it can never delay or block a merge. `AC-006` requires that
  property, and `test/perf/perf-artifacts.spec.ts` asserts it by reading the
  workflow file.
- **What it asserts:** only deterministic budgets — exact integer `queries` and
  `docsReturned` per calculator. Wall-clock numbers are printed for manual
  comparison and **never** fail the job. Duration on a shared runner describes
  the runner, not the code, so enforcing it would produce a flaky gate that the
  team eventually ignores. Timing budgets exist but activate only under
  `PERF_ENFORCE_TIMING=1`.
- **Consequence:** a query-shape change that adds an N+1 or drops a `select()`
  fails this workflow on the next weekday morning. It will not show up on the PR.
  When touching a module that has a performance layer, run `npm run test:perf`
  locally before pushing.
- It does not run the unit or E2E suites, and neither of those collects
  `test/perf/`, so the two layers cannot interfere. See
  `documents/engineering/testing.md` section 3.

The k6 layer (`npm run perf:seed` + `npm run test:perf:k6`) drives a real
`POST /graphql` and is **not** wired into this workflow: it needs a running
server and a seeded database. Its script contract is covered by
`test/perf/perf-artifacts.spec.ts` instead.

## 5. What This Means for Engineers

- Every push to any branch runs the `quality` job; open a PR against `main` and
  wait for the `CI / quality` check to pass before merging; do not merge a red
  pipeline. Merging to `main` triggers Render's native auto-deploy.
- Running the same commands locally before pushing shortens the feedback loop.
- A red `Performance (stats-charts)` run is **not** urgent in the same way: it
  means a query shape moved, not that a feature broke. Investigate whether the
  change was deliberate before relaxing anything.
- If the CI/CD setup changes again (for example, moving deploy into a Git workflow
  or adding coverage gates), this document must be updated to describe it.
