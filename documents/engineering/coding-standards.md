# Engineering Coding Standards

> **Status:** Current
> **Last updated:** 2026-09-12

Conventions that apply to the WaveFit API codebase. This document records only rules that are actually observed in this repository. The canonical module catalog and structure live in `documents/engineering/architecture.md`; this page extends them with the TypeScript/Mongoose practices verified in the source.

## 1. Naming

| Item | Rule |
|---|---|
| Files | `kebab-case.ts` |
| Classes | `PascalCase` |
| DTOs | `create-*.input.ts`, `*.output.ts` (GraphQL input/output types) |
| Schemas | `*.schema.ts` (Mongoose) |
| Test files | `*.spec.ts` (colocated with the tested unit) |
| Env vars | UPPER_SNAKE_CASE (e.g. `JWT_SECRET`, `GROQ_API_KEY`) |

## 2. NestJS Modules

- **Standalone modules with explicit imports.** A module declares exactly the `MongooseModule.forFeature(...)` models it needs and imports/exports only what it requires. There is no global/shared module magic for feature wiring.
- Provider binding follows `@Injectable()` in the regular NestJS way; circular dependencies between services are handled with `forwardRef(() => ...)` (example: week-log use case injecting `WorkoutSessionService`).
- Mongoose feature registration always uses the class name: `{ name: Exercise.name, schema: ExerciseSchema }`. The injection token that matches is `getModelToken(Exercise.name)`.
- DTOs are validated with `class-validator` (decorators such as `@IsMongoId`, `@IsOptional`, `@Min`, `@Max`, `@IsEnum`).

## 3. Testing

- All tests use **Jest**, files named `*.spec.ts`.
- Unit specs mock dependencies; the Jest config is unified in `jest.config.js` (the `jest` key was removed from `package.json`). When running Jest directly, always pass `--config jest.config.js`.
- E2E specs live in `test/e2e/` and boot the app via `AppTestModule` against in-memory MongoDB.
- Relevant provider-mock rules: provide Mongoose models under `getModelToken(Class.name)`; mock `EventEmitter2` with `{ emit: jest.fn() }`; for hexagonal modules mock the use case `.execute()`.

See `documents/engineering/testing.md` for the full testing contract.

## 4. GraphQL Conventions

- **Token in HttpOnly cookie `token`** — never in an `Authorization` header. The client never sees the token.
- Protected resolvers use `@UseGuards(GqlAuthGuard)` and read the authenticated user from `@Context()` (`context.req.user`).
- GraphQL operations that would collide in the schema are renamed with `name` overrides (e.g. `workoutSessionFindAll`, `dayLogFindOne`) instead of being hidden by a later registration.
- Output entity classes mirror the GraphQL types (e.g. `entities/` folders); inputs mirror the `*.input.ts` DTOs.

## 5. Mongoose Conventions

- **Never assume Mongoose casts strings to ObjectId.** In Mongoose 8, `insertMany` does not auto-cast a string `_id` to `ObjectId`, and queries built with `new Types.ObjectId(id)` will not match documents whose `_id` was stored as a string. When creating or querying, convert explicitly with `new Types.ObjectId(...)` — including nested reference fields (`userId`, `weekLogId`, `routineDayId`).
- Batch inserts go through a service method that maps every id field to `new Types.ObjectId(...)` before calling `insertMany`, so the DB stores real ObjectIds.
- Normalized search keys are persisted explicitly (e.g. `normalizedName` computed via `normalizeString()`), not derived per-query.
- Unique indexes on normalized/lookup fields are declared in the schema (e.g. the exercises `normalizedName` unique index); seed/bulk code must deduplicate before inserting to avoid index-violation failures.

## 6. TypeScript Conventions Observed

- Strict, explicit typing: classes, method return types and DTO field decorators are written out; `any` is used sparingly, mostly in test fixtures and Mongo repair scripts.
- `import` order keeps type/value imports together; relative imports start from `src/...` using the `_moduleAliases`/`moduleNameMapper` mapping.
- No unused documented rule beyond ESLint/Prettier: `npm run lint` (ESLint with `--fix`) and `npm run format` (Prettier) are the enforced formatters.
- Comments in new code are avoided unless explicitly useful; existing comments may remain as-is.
- Logging uses the NestJS `Logger` service in services; standalone `console.log`/`console.error` occurrences remain in a few spots (e.g. `plan-generator.parser.ts:51`) and are known debt, not the convention.

## 7. What This Repository Deliberately Does Not Have

- No custom lint rule sets beyond the ESLint/Prettier defaults configured in the repo.
- No code-gen requirement beyond the NestJS CLI scaffolds used historically (the codebase follows the same conventions whether or not the files were generated).
- No enforced coverage threshold; CI runs the quality gate (build, lint, unit, e2e) but coverage stays informational — see `documents/engineering/ci-cd.md`.