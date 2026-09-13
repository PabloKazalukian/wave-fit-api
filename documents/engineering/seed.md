# Engineering Seeding

> **Status:** Current
> **Last updated:** 2026-09-12

The autoseeding architecture of the WaveFit API: how the database is populated on startup, the seeded data, and the idempotency rules. The source of truth for the seed flow and data is `src/database/seed-runner.ts` and `src/database/seeds/routines.seed.ts`.

## 1. Purpose

Automatic initial population of the database when the application boots. Seeding runs automatically via `OnApplicationBootstrap` and only inserts data when the target collections are empty, so restarts never duplicate records.

## 2. Architecture

| File | Role |
|---|---|
| `src/database/seed-runner.ts` | `SeedService` — orchestrator; implements `OnApplicationBootstrap` and runs `run()` |
| `src/database/seed.module.ts` | NestJS module that registers the three Mongoose models and provides `SeedService` |
| `src/database/seeds/routines.seed.ts` | Seed data: exercise catalog, routine days and the PPL routine plan |

`SeedModule` registers `Exercise`, `RoutineDay` and `RoutinePlan` via `MongooseModule.forFeature([{ name: X.name, schema: XSchema }])` and provides/exports `SeedService`. The service is registered in the app bootstrap, so `onApplicationBootstrap()` is triggered on every app start.

## 3. Flow

```
App bootstrap
  → SeedService.onApplicationBootstrap()
    → SeedService.run()
      1. Exercise.countDocuments() === 0?
         Yes → deduplicate by normalizedName, insert catalog
         No  → skip; run a normalization backfill for exercises
               that still lack normalizedName
      2. RoutineDay.countDocuments() === 0?
         Yes → build and insert the 6 PPL days (referencing saved exercises)
         No  → skip
      3. RoutinePlan.findOne({ name: 'PPL 6 días — Principiante/Intermedio' })?
         No  → create the weekly PPL plan (referencing saved days)
         Yes → skip
```

Each step logs what it did and continues independently; whichever step finds existing data is skipped.

## 4. Seeded Data

### Exercise catalog

`SEEDED_EXERCISES` currently defines **30** exercises with name, category, `usesWeight` flag and description. Before insertion, every entry is normalized with `normalizeString()` and deduplicated by normalized name (the `normalizedName` unique sparse index from `exercise.schema.ts` would reject colliding variants). On a fresh database all 30 entries are inserted.

> Note: an earlier (historical) seed document cited a total of 28 exercises; the current source array contains 30 distinct entries, all unique after normalization. The 28 figure refers to an earlier seed set.

Categories and counts as they appear in the source (`src/database/seeds/routines.seed.ts`):

| Category | Count | Exercises |
|---|---|---|
| `CHEST` | 4 | Press de banca plano, Press de banca inclinado, Aperturas con mancuernas, Flexiones |
| `SHOULDERS` | 3 | Press militar, Elevaciones laterales, Elevaciones frontales |
| `TRICEPS` | 3 | Fondos en paralelas, Extensión de tríceps en polea, Press francés |
| `BACK` | 5 | Dominadas, Remo con barra, Jalón al pecho en polea, Remo con mancuerna, Pullover con mancuerna |
| `BICEPS` | 3 | Curl con barra, Curl con mancuernas alterno, Curl martillo |
| `LEGS_FRONT` | 3 | Sentadilla, Prensa de piernas, Extensión de cuádriceps |
| `LEGS` | 2 | Zancadas, Elevación de talones de pie |
| `LEGS_POSTERIOR` | 3 | Peso muerto rumano, Curl femoral tumbado, Hip thrust |
| `CORE` | 4 | Plancha, Crunch abdominal, Elevación de piernas, Russian twist |

### Routine days (6)

Push A → Pull A → Legs A → (rest) → Push B → Pull B → Legs B.

Each day carries a `title`, a `type` (list of categories) and `exercises` referencing catalog exercises with an `order`:

| Day | Category types | Exercises (in order) |
|---|---|---|
| Push A | CHEST, SHOULDERS, TRICEPS | Press de banca plano, Press militar, Aperturas con mancuernas, Elevaciones laterales, Extensión de tríceps en polea |
| Pull A | BACK, BICEPS | Dominadas, Remo con barra, Jalón al pecho en polea, Curl con barra, Curl martillo |
| Legs A | LEGS_FRONT, LEGS_POSTERIOR, CORE | Sentadilla, Peso muerto rumano, Prensa de piernas, Curl femoral tumbado, Plancha |
| Push B | CHEST, SHOULDERS, TRICEPS | Press de banca inclinado, Press de banca plano, Elevaciones frontales, Elevaciones laterales, Press francés, Fondos en paralelas |
| Pull B | BACK, BICEPS | Remo con mancuerna, Jalón al pecho en polea, Pullover con mancuerna, Curl con mancuernas alterno, Curl martillo |
| Legs B | LEGS_FRONT, LEGS, CORE | Zancadas, Hip thrust, Extensión de cuádriceps, Elevación de talones de pie, Elevación de piernas, Russian twist |

### Default routine plan

- **Name:** `PPL 6 días — Principiante/Intermedio`
- **Description:** Push Pull Legs with twice-weekly frequency, alternating A/B variants for maximal progression.
- **`weekly_distribution`:** `6`
- **Week schedule:** Monday Push A, Tuesday Pull A, Wednesday Legs A, Thursday rest, Friday Push B, Saturday Pull B, Sunday Legs B — 6 training days, 1 rest day.

## 5. Name Normalization

Every exercise is stored with a `normalizedName` field computed by `normalizeString()` (`src/common/utils/string.utils.ts`):

1. Lowercase.
2. Accent removal (NFD + stripping combining marks).
3. Removal of special characters.
4. Tokenization and re-join with single spaces.

This makes searches and comparisons independent of accents, capitalization and spacing. The same normalization feeds the similar-name control (`isSimilar()` with `fastest-levenshtein`) used by `ExerciseService` on create/update, and the seed-time deduplication described above.

## 6. Idempotency

- **Triggers only when empty:** exercises insert only if `countDocuments() === 0`; routine days only if `countDocuments() === 0`; the routine plan only if no document matches the exact name `PPL 6 días — Principiante/Intermedio`.
- **Normalization backfill:** when exercises already exist, the runner finds documents missing `normalizedName` and backfills them with `normalizeString(name)` — an idempotent operation (already-normalized documents are untouched).
- **Dedup before insert:** normalized-name duplicates in the seed array are skipped before calling `insertMany`, avoiding unique-index violations on restart or with variant spellings.
- **Rule for future seeds:** every insertion must verify existing data before writing, so restarts never duplicate.

## 7. Adding New Seeds

1. Add exercises to the `SEEDED_EXERCISES` array in `src/database/seeds/routines.seed.ts`.
2. For a new routine day, add it in `buildRoutineDays()`.
3. For a new plan, create a function similar to `buildRoutinePlan()`.
4. Add the check-and-insert logic in `seed-runner.ts`.
5. Register the corresponding model in the `imports` of `SeedModule`.