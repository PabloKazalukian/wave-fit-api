import { PERF_SIZES, type PerfSize } from './fixtures/perf-dataset';

export const PERF_QUERIES = [
  'oneRmWeekly',
  'volumeWeekly',
  'volumeTotalWeekly',
  'caloriesWeekly',
  'forgottenMuscles',
  'exerciseTrend',
  'dashboard',
] as const;

export type PerfQueryName = (typeof PERF_QUERIES)[number];

export interface PerfQueryBudget {
  /** MongoDB commands issued, excluding cursor continuation traffic. */
  queries: number;
  /** Documents materialized into Node memory. */
  docsReturned: number;
}

export type PerfBudgetTable = Record<PerfQueryName, PerfQueryBudget>;

/**
 * Hard budgets on the deterministic metrics.
 *
 * These are the **measured current values**, not the desired ones: this layer is
 * a characterization lock, so that any change to the query shape of a
 * calculator turns the bench red and forces a deliberate, Spec'd decision
 * (`BR-001`, `FR-007`). Optimizing past them belongs to a separate Spec — the
 * duplicated session reads, the unfiltered exercise catalog, the absent
 * projections and the unbounded weight-log scan are all recorded in `BR-007`
 * precisely so that such a Spec can start from a measured baseline.
 *
 * Because they are counts and not durations, the budgets are machine-independent:
 * they describe the code, not the hardware that ran it.
 *
 * Derivation (medium): 68 in-window sessions, 17 in-window extra sessions,
 * 18 weight logs, 30 exercises, 6 routine days, 1 plan, 1 week log, 1 day log,
 * 1 user profile.
 */
export const PERF_QUERY_BUDGETS: Record<PerfSize, PerfBudgetTable> = {
  small: {
    oneRmWeekly: { queries: 2, docsReturned: 42 },
    volumeWeekly: { queries: 2, docsReturned: 42 },
    volumeTotalWeekly: { queries: 1, docsReturned: 12 },
    caloriesWeekly: { queries: 3, docsReturned: 10 },
    forgottenMuscles: { queries: 6, docsReturned: 51 },
    exerciseTrend: { queries: 2, docsReturned: 42 },
    dashboard: { queries: 16, docsReturned: 199 },
  },
  medium: {
    oneRmWeekly: { queries: 2, docsReturned: 98 },
    volumeWeekly: { queries: 2, docsReturned: 98 },
    volumeTotalWeekly: { queries: 1, docsReturned: 68 },
    caloriesWeekly: { queries: 3, docsReturned: 36 },
    forgottenMuscles: { queries: 6, docsReturned: 107 },
    exerciseTrend: { queries: 2, docsReturned: 98 },
    dashboard: { queries: 16, docsReturned: 505 },
  },
  large: {
    oneRmWeekly: { queries: 2, docsReturned: 98 },
    volumeWeekly: { queries: 2, docsReturned: 98 },
    volumeTotalWeekly: { queries: 1, docsReturned: 68 },
    caloriesWeekly: { queries: 3, docsReturned: 97 },
    forgottenMuscles: { queries: 6, docsReturned: 107 },
    exerciseTrend: { queries: 2, docsReturned: 98 },
    dashboard: { queries: 16, docsReturned: 566 },
  },
};

/**
 * Timing is never budgeted by default (`BR-002`): wall-clock on a shared runner
 * is a property of the machine, not of the code. These are only consulted when
 * `PERF_ENFORCE_TIMING=1`, and are deliberately loose.
 */
export const PERF_ELAPSED_BUDGET_MS: Record<PerfQueryName, number> = {
  oneRmWeekly: 1500,
  volumeWeekly: 1500,
  volumeTotalWeekly: 1500,
  caloriesWeekly: 1500,
  forgottenMuscles: 2000,
  exerciseTrend: 1500,
  dashboard: 4000,
};

export const PERF_TIMING_ENFORCED = process.env.PERF_ENFORCE_TIMING === '1';

export function budgetFor(
  size: PerfSize,
  query: PerfQueryName,
): PerfQueryBudget {
  return PERF_QUERY_BUDGETS[size][query];
}

export const PERF_BUDGET_SIZES = PERF_SIZES;
