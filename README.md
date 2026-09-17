<p align="center">
  <img src="https://nestjs.com/img/logo-small.svg" alt="WaveFit API Logo" width="120" />
</p>

<h1 align="center">WaveFit API</h1>

<p align="center">
  <strong>Backend for your personal training companion.</strong><br/>
  A GraphQL API to manage exercises, routines and training tracking.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-11-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" />
  <img src="https://img.shields.io/badge/GraphQL-Apollo-E10098?style=for-the-badge&logo=graphql&logoColor=white" />
  <img src="https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
</p>

<p align="center">
  <a href="https://wave-fit.vercel.app/">View Frontend Demo</a> •
  <a href="https://github.com/PabloKazalukian/wave-fit">Frontend Repository</a>
</p>

---

## Features

### Available

- **Exercise management** — full CRUD over the exercise catalog
- **Routine planning** — RoutinePlan → RoutineDay → Exercises
- **Training tracking** — WorkoutSession, WeekLog, ExtraSession, DayLog
- **Secure authentication** — JWT in an HttpOnly cookie + Google OAuth (PKCE)
- **AI-generated training plans** — `generatePlan` / `confirmPlan` / `modifyPlan`
- **Change audit** — automatic DB change records (AuditLogs)

### Upcoming

- **Advanced statistics** — analytics endpoints (stats module is experimental)
- **WebSockets** — real-time updates

---

## Tech Stack

| Category      | Technology          |
| ------------- | ------------------- |
| **Framework** | NestJS 11           |
| **API**       | GraphQL (Apollo)    |
| **Database**  | MongoDB (Mongoose)  |
| **Auth**      | Passport + JWT      |
| **OAuth**     | Google (PKCE)       |
| **Testing**   | Jest                |

> **Frontend:** Angular + TailwindCSS + Apollo — [repository](https://github.com/PabloKazalukian/wave-fit) | [production demo](https://wave-fit.vercel.app/)

---

## Setup

### Prerequisites

- Node.js (v18+)
- MongoDB (local or Atlas)
- npm

### Install and run

```bash
git clone https://github.com/PabloKazalukian/wave-fit-api.git
cd wave-fit-api
npm install

cp .env.example .env   # edit with your credentials
npm run build

npm run start:dev
```

The API is available at `http://localhost:3000/`.

---

## Project Structure

```
src/
├── app.module.ts              # Root module
├── main.ts                    # Entry point
├── common/                    # Filters, interceptors, guards, utils
├── modules/
│   ├── auth/                  # JWT + Google OAuth
│   ├── user/                  # Users + user-profile bounded contexts
│   ├── storage/               # Avatar upload (S3) helper
│   ├── routines/
│   │   ├── templates/         # exercise, routine-day, routine-plan
│   │   └── tracking/          # workout-session, week-log, day-log, extra-session, training-history
│   ├── ai/                    # Transversal LLM layer (executePrompt)
│   ├── training-plan/         # AI-generated training plans
│   ├── stats/                 # Metrics (experimental)
│   └── audit-logs/            # DB change records
```

## GraphQL Playground

In development the Playground is available at:

```
http://localhost:3000/graphql
```

Example query:

```graphql
query {
  me {
    id
    email
    name
  }
}
```

## Deploy: Render

Production is hosted on **Render**:

- Frontend: `https://wave-fit-front.onrender.com` (CORS origin in `src/main.ts`)
- API: `https://wave-fit-api.onrender.com` (Google OAuth redirect target)
- Deployment is the **native Render auto-deploy**: a push to `main` builds and deploys automatically (configured on the Render dashboard).
- CI runs on GitHub Actions (build, lint, unit and e2e) on every push to any branch and on pull requests targeting `main` — see `documents/engineering/ci-cd.md`.

## Documentation

- **`AGENTS.md`** is the navigation entry point for engineers and AI agents.
- **`documents/engineering/`** — stable rules: charter, architecture, testing, coding standards, git workflow, CI/CD, seed.
- **`documents/domain/`** — domain overview, glossary, business rules.
- **`documents/modules/`** — implemented, validated module state.
- **`documents/decisions/`** — ADRs (decision rationale).
- **`sdd/`** — feature specs (feature contracts, authoritative alongside the code).
- **`documents/plans/`** — active/pending implementation plans.
- **`documents/legacy/plans/`** — historical/non-authoritative execution plans (archived after implementation).

## Tests

```bash
npm test                # unit tests
npm run test:cov        # unit coverage
npm run test:e2e        # e2e tests
npm run test:e2e:cov    # e2e coverage
npm run test:cov:combined  # unit + e2e merged coverage
```

## Author

**[Pablo Kazalukian](https://github.com/PabloKazalukian)**

> [Frontend repository](https://github.com/PabloKazalukian/wave-fit) | [Production demo](https://wave-fit.vercel.app/)