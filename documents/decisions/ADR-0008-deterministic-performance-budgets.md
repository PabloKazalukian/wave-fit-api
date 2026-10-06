> **Status:** Current
> **Last updated:** 2026-10-06

# ADR-0008: Deterministic budgets over timing in performance tests

## Context

The `stats-charts` module computes all six charts in memory on every request: no `aggregate()`
pipeline, no persistence, no batching, and no `select()`/`limit()` anywhere in the module. Every read
goes straight to the tracking collections and is bounded only by `STATS_CHARTS_MAX_RANGE_DAYS = 120`,
while `getStatsCaloriesWeekly` loads the user's entire `userweightlogs` history with no lower bound.
A dashboard render multiplies whatever per-query cost exists by six.

Nothing measured that cost. `documents/engineering/testing.md` defined exactly two layers (unit, E2E),
no Spec carried a performance NFR, and the CI pipeline had no perf step. The temptation, then, was to
reach for the obvious metric: how long a request takes.

Wall-clock is the wrong instrument here, for a reason worth stating precisely. CI runs on shared,
noisy runners whose load varies with unrelated jobs. A duration measured there is a property of the
machine, not of the code. Asserting on it produces a test that fails for reasons nobody can act on,
and a gate that flake is quietly ignored — which is worse than no gate at all, because it spends
trust to buy nothing.

There was also a subtler question: **when a budget fails, what does that mean?** A budget equal to the
desired performance is aspirational, and an aspirational benchmark shipped alongside code that misses
it is a permanently red suite. People learn to ignore red. The alternative is to assert what the code
*currently* does, so the test is green and any deviation is a genuine change that someone chose.

## Decision

Performance tests in this project assert **deterministic counts, never durations**.

- The asserted metrics are **exact integers**: `queries` (MongoDB commands the code issued, excluding
  `getMore`/`killCursors`) and `docsReturned` (documents materialized into Node memory). Counts are
  machine-independent, so a budget means the same thing on a laptop and on a shared runner.
- Budgets are the **measured current values** — a characterization lock, not a target. Adding a
  `select()`, an `aggregate()` or a shared repository turns the suite red, and turning it green
  requires a deliberate, Spec'd decision rather than editing a number.
- Timing is **reported but not enforced**. Looser wall-clock thresholds may exist as sanity checks,
  and real figures are exported for manual comparison against a stored baseline, but a hard timing
  assertion is opt-in behind an explicit flag (`PERF_ENFORCE_TIMING=1`).
- Because an enforced duration is unreliable, the performance layer is **scheduled nightly and
  never runs on a pull request**. The PR gate stays exactly `build` → `lint:ci` → `test` → `test:e2e`.
- Determinism is a structural prerequisite, not a nicety: a seeded PRNG, a fixed anchor date, and no
  `Math.random()` or `new Date()` in a dataset generator. Without a reproducible dataset the integer
  budgets are meaningless.

## Consequences

- **Positive:** the suite cannot flake, so `npm run test:perf` is trustworthy in the inner loop. A red
  result is always a real signal — a query shape moved — and it names the exact metric that moved.
  Because budgets describe behavior rather than speed, a future optimization Spec can start from a
  measured baseline instead of guessing where the cost is.
- **Negatives:** the layer cannot answer "is this fast enough?", only "is this doing what it did
  before?". Absolute performance must be judged from exported figures by a human, and drift in
  hardware, driver or dataset volume will not trip the suite. Determinism also has a maintenance
  price: the dataset generator, the anchor date and the budget table all have to be updated together
  when a dataset changes, or the suite reports a false regression.
- **Consequence for the reader:** never treat a red performance suite as a machine problem, and never
  resolve one by relaxing a budget silently. That is a change of contract and belongs in a Spec.

## Related

- Feature contract: `sdd/stats-charts-performance.spec.md`
- Measured hotspots this policy exists to expose: `BR-007` of that Spec, recorded in
  `documents/modules/stats-charts.md`
- Test layers and commands: `documents/engineering/testing.md`; nightly workflow:
  `documents/engineering/ci-cd.md` section 4

## Status

Accepted