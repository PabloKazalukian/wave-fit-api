# Engineering CI/CD

> **Status:** Current
> **Last updated:** 2026-09-12

## 1. Current State: No Automated CI/CD Pipeline

Honest assessment of this repository today: **there is no automated CI/CD pipeline.** Specifically:

- No GitHub Actions workflows (`.github/workflows/` does not exist).
- No `.gitlab-ci.yml`, no `Jenkinsfile`, no `.circleci/` configuration.
- No `Dockerfile`, `render.yaml`, or any other deployment manifest in the repository.
- No CI status checks, build reports, or coverage gates are produced automatically anywhere.

Integration happens through the normal Git history (feature branches merged into `main`) and the checks described in section 2 must be executed **manually by the developer** before every merge. Do not assume that any commit, push or pull request is validated automatically.

## 2. Manual Quality Gates for a Feature Branch

Before a feature branch may be merged into `main`, all four commands must pass locally (they are also the validation baseline used by the Engineering Charter and the Spec workflow):

```bash
npm run build      # TypeScript compile (tsc -p tsconfig.build.json)
npm run lint       # ESLint (currently runs with --fix over "src/**/*.ts")
npm test           # Unit suite (jest, config from jest.config.js)
npm run test:e2e   # E2E suite (jest --config ./test/jest-e2e.json --maxWorkers=2)
```

- `npm run lint` applies `--fix` to the scope, so it may rewrite files; review the resulting diff.
- The unit and E2E suites are independent and both must be green.
- Coverage is informational (measured with `npm run test:cov:combined`) and is not a merge gate.

## 3. Deployment

- The application is deployed to **Render** (see README.md "Deploy: Render").
- Production origins in the source confirm the Render deployment: the CORS origin `https://wave-fit-front.onrender.com` (`src/main.ts`) and the Google OAuth redirect `https://wave-fit-api.onrender.com` (`src/modules/auth/google/google.strategy.ts`).
- Required environment variables are documented in `documents/modules/auth.md` and `documents/modules/ai.md`: `JWT_SECRET`, `JWT_EXPIRATION`, `DB_MONGO_PASSWORD`, `FRONTEND_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GROQ_API_KEY`, `PREFERRED_AI_PROVIDER`, plus the AI module tuning vars (`AI_DAILY_LIMIT`, `AI_CALL_TIMEOUT_MS`, `AI_MAX_ATTEMPTS`, `AI_TOTAL_BUDGET_MS`, `AI_MAX_OUTPUT_TOKENS`).

## 4. What This Means for Engineers

- Every merge relies on the developer running the manual gate above; state the validation results in the PR/merge description.
- Adding CI is a future improvement, not a current capability. If a CI/CD pipeline is introduced, this document must be updated to describe it instead of the manual-only process.