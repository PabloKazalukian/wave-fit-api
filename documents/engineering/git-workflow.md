# Git Workflow

> **Status:** Current
> **Last updated:** 2026-09-12
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
- **Commit message format (mandatory):** `feat/<what-was-done>: <brief english description>`. The `feat/` prefix names what the commit implements; the description is short, imperative, and specific.
  - Examples: `feat/sdd: implement spec-anchored documentation principle`, `feat/day-log: add standalone training day tracking`, `feat/seed: correct exercise catalog count`.
  - Use `feat/` for features and value-delivering changes (including documentation, chores, and fixes that complete a feature). Historical commits used a lowercase descriptive style (e.g. `add SDD conventions and day-log spec`); do not rewrite historical commits to change their language.
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