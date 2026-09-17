# Plan: Automated CI with GitHub Actions

> **Status:** Historical / Non-Authoritative (implemented and validated 2026-09-17)
> **Executed on branch:** `feat/ci-cd`

## Context

`documents/engineering/ci-cd.md` states that the repository has **no automated
CI/CD pipeline**: the four canonical quality gates (`build`, `lint`, `test`,
`test:e2e`) are run manually by the developer before every merge. This plan
introduces the first automated pipeline (CI only) using GitHub Actions, which
complements the existing Render deployment (still manual).

The test suites boot real NestJS modules whose providers validate environment
variables at construction time (`GoogleStrategy`, `GroqProvider`), so a clean
clone without a `.env` file cannot run the E2E suite. The pipeline must provide
dummy, non-secret environment values for the tests.

## Decisions

| Question | Decision |
|---|---|
| Scope | CI only (build + lint + unit + e2e). Deployment/CD stays manual on Render. |
| Platform | GitHub Actions (remote is `github.com/PabloKazalukian/wave-fit-api`). |
| Job structure | A single job running the four gates sequentially (mirrors the manual gate). |
| Triggers | `pull_request` to `main`, `push` to `main`, `workflow_dispatch`. |
| Node version | 22 (matches `@types/node ^22`). |
| Lint in CI | New `lint:ci` script without `--fix`; the local `lint` keeps `--fix`. |
| Test env | Dummy non-secret values in the workflow `env:` block. |
| Hygiene | Commit `.env.example` (placeholders only) and broaden `.gitignore` to `.env*` with `!.env.example`. |
| Out of scope | Coverage gate, deploy job, Docker, multi-Node matrix, CI badge. |

## Tasks

1. `package.json` — add `lint:ci` script (`eslint "src/**/*.ts"`, no `--fix`).
2. `.github/workflows/ci.yml` — single `quality` job on `ubuntu-latest`, Node 22,
   `npm ci` with npm cache, dummy `env:` vars, then `build` → `lint:ci` → `test`
   → `test:e2e`. `concurrency` cancels superseded runs of the same ref.
3. `.env.example` — committed placeholder file for every env var actually read
   by `src/`.
4. `.gitignore` — ignore `.env*` except `.env.example`.
5. Validation — run the full gate locally with `.env` disabled and only the
   workflow's dummy env values, to prove a clean clone passes. Restore `.env`.
6. Documentation (after validation) — update `documents/engineering/ci-cd.md`
   and `documents/engineering/testing.md` to describe the automated gate.

## Validation

```bash
npm run build
npm run lint:ci
npm test
npm run test:e2e
```

Executed with `.env` temporarily disabled and only the CI dummy env values set
(`GROQ_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`,
`PREFERRED_AI_PROVIDER`). Results (2026-09-17):

- `npm run build` — OK
- `npm run lint:ci` — 0 errors (15 warnings)
- `npm test` — 67 suites / 673 tests passed
- `npm run test:e2e` — 32 suites / 169 tests passed

## Outcome

- [x] `lint:ci` script added
- [x] `.github/workflows/ci.yml` created
- [x] `.env.example` created, `.gitignore` broadened
- [x] Full gate green in a CI-like environment
- [x] `ci-cd.md` and `testing.md` updated
