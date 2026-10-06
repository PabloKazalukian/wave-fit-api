# Git Workflow

> **Status:** Current
> **Last updated:** 2026-10-06
> **Authority level:** Stable engineering rule. See the Engineering Charter for the overall methodology.

## 1. Branch Strategy

The repository uses a lightweight feature-branch workflow. The integration branch is `main` and is never worked on directly for feature changes.

| Branch type | Pattern | Example |
|---|---|---|
| Feature | `feat/<feature-name>` | `feat/day-log`, `feat/sdd` |
| Bug fix | `fix/<bug-name>` | `fix/objectid-casting` |
| Integration / stable | `main` | — |

- Feature branches are created from `main` (working tree clean).
- When a feature spans multiple phases, the phases live on the same feature branch and are committed incrementally.
- Do not introduce another branching convention (e.g. `feature/`, camelCase, versioned branches) unless project requirements clearly require it.

## 2. Commits

- Commit messages are **English**, concise, and descriptive of the change.
- **Commit message format (mandatory):** `<type>(<scope>): <description>`, following Conventional Commits. The description is short, imperative and specific; the scope names the feature area and is omitted only when the change genuinely spans areas.
  - Types used in this repository: `feat` (features and value-delivering changes, including documentation and chores), `fix` (defect corrections), `docs` (documentation only) and `test`. The remaining Conventional Commits types (`chore`, `ci`, `refactor`, `perf`, `build`, `style`) may be used with their standard meaning.
  - Examples: `feat(stats-charts): add date-range on-the-fly chart calculations`, `fix(stats-charts): cast userId to ObjectId at every query boundary`, `docs(perf): correct the maxWorkers rationale`, `test(perf): assert the k6 documents against the served schema`.
  - This rule replaces an earlier `feat/<what-was-done>: <description>` format. That format was real and was used by the documentation- and stats-era commits (`feat/sdd:`, `feat/audit:`, `feat/stats:`), but it is ambiguous with the rule adopted here: `feat/stats:` reads as a `feat/<what>` message under one rule and as `feat(scope)` under the other, and nothing in the subject separates them. Do not rewrite historical commits to change their language or format.
- Commit after each completed, validated unit of work (one task = one commit when possible).
- Do not commit secrets, generated artifacts, or unrelated files. Stage only the files that belong to the change.
- Do not amend or force-push commits unless explicitly requested.

## 3. Working From a Feature Branch

```text
git checkout -b feat/<feature-name>   # from main, with a clean tree
... implement one task at a time ...
git add <intended-files>
git commit -m "feat/<what-was-done>: <brief english description>"
```

## 4. main Branch Rules

- No direct commits to `main` for features or fixes.
- `main` is only advanced via integration (merge) of completed, validated feature branches.
- Before integrating, the full validation suite must pass:
  - `npm run build`
  - `npm run lint`
  - `npm test`
  - `npm run test:e2e`

## 5. Pull Requests / Merges

- Merges follow the repository's existing Git history style (merge commits are used, e.g. `Merge branch 'feat/day-log'`).
- A PR/merge description must reference the relevant Spec and note validation results.
- Do not include unrelated documentation or code changes in a feature merge.