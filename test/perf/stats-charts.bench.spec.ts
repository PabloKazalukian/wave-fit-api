import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  PERF_SIZES,
  PERF_SIZE_SPECS,
  PERF_TIMEZONE,
  buildPerfDataset,
  type PerfDataset,
  type PerfSize,
} from './fixtures/perf-dataset';
import {
  createPerfHarness,
  seedPerfDatasets,
  type PerfHarness,
} from './fixtures/perf-mongoose';
import {
  QueryMetricsCollector,
  type QueryMetrics,
} from './metrics/query-metrics';
import {
  PERF_ELAPSED_BUDGET_MS,
  PERF_TIMING_ENFORCED,
  budgetFor,
  type PerfQueryName,
} from './stats-charts.budget';

const WARMUP_ITERATIONS = 2;
const MEASURED_ITERATIONS = 5;

interface Measurement extends QueryMetrics {
  medianMs: number;
  resultCount: number;
}

interface Report {
  generatedFor: 'stats-charts-performance';
  timezone: string;
  warmupIterations: number;
  measuredIterations: number;
  timingEnforced: boolean;
  sizes: Record<
    PerfSize,
    {
      historyDays: number;
      windowDays: number;
      window: { from: string; to: string };
      dataset: PerfDataset['counts'];
      queries: Record<PerfQueryName, Measurement>;
    }
  >;
}

const report: Report = {
  generatedFor: 'stats-charts-performance',
  timezone: PERF_TIMEZONE,
  warmupIterations: WARMUP_ITERATIONS,
  measuredIterations: MEASURED_ITERATIONS,
  timingEnforced: PERF_TIMING_ENFORCED,
  sizes: {} as Report['sizes'],
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function runQuery(
  harness: PerfHarness,
  dataset: PerfDataset,
  query: PerfQueryName,
): Promise<{ value: unknown; length: number }> {
  const { userId, from, to } = dataset;
  const tz = PERF_TIMEZONE;
  const { calculators } = harness;

  switch (query) {
    case 'oneRmWeekly':
      return calculators.oneRmWeekly.execute(userId, from, to, tz);
    case 'volumeWeekly':
      return calculators.volumeWeekly.execute(userId, from, to, tz);
    case 'volumeTotalWeekly':
      return calculators.volumeTotalWeekly.execute(userId, from, to, tz);
    case 'caloriesWeekly':
      return calculators.caloriesWeekly.execute(userId, from, to, tz);
    case 'forgottenMuscles':
      return calculators.forgottenMuscles.execute(userId, from, to, tz);
    case 'exerciseTrend':
      return calculators.exerciseTrend.execute(userId, from, to, tz);
    case 'dashboard':
      return Promise.all([
        calculators.oneRmWeekly.execute(userId, from, to, tz),
        calculators.volumeWeekly.execute(userId, from, to, tz),
        calculators.volumeTotalWeekly.execute(userId, from, to, tz),
        calculators.caloriesWeekly.execute(userId, from, to, tz),
        calculators.forgottenMuscles.execute(userId, from, to, tz),
        calculators.exerciseTrend.execute(userId, from, to, tz),
      ]);
    default:
      throw new Error(`Unknown query: ${query}`);
  }
}

function resultLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 1;
}

async function measure(
  harness: PerfHarness,
  dataset: PerfDataset,
  query: PerfQueryName,
): Promise<Measurement> {
  for (let i = 0; i < WARMUP_ITERATIONS; i++) {
    await runQuery(harness, dataset, query);
  }

  const samples: number[] = [];
  let metrics: QueryMetrics = { queries: 0, roundTrips: 0, docsReturned: 0 };
  let resultCount = 0;

  for (let i = 0; i < MEASURED_ITERATIONS; i++) {
    const started = performance.now();
    const measured = await QueryMetricsCollector.measure(
      harness.collector,
      () => runQuery(harness, dataset, query),
    );
    samples.push(performance.now() - started);
    metrics = measured.metrics;
    resultCount = resultLength(measured.result);
  }

  return {
    ...metrics,
    medianMs: Math.round(median(samples) * 100) / 100,
    resultCount,
  };
}

function writeReport(): void {
  const directory = join(__dirname, 'results');
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, 'in-process.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
}

describe('stats-charts performance (in-process)', () => {
  let harness: PerfHarness;
  let datasets: Record<PerfSize, PerfDataset>;

  beforeAll(async () => {
    harness = await createPerfHarness();
    datasets = Object.fromEntries(
      PERF_SIZES.map((size) => [size, buildPerfDataset(size)]),
    ) as Record<PerfSize, PerfDataset>;
    await seedPerfDatasets(harness.moduleRef, Object.values(datasets));
  }, 180_000);

  afterAll(async () => {
    if (harness) await harness.close();
  });

  for (const size of PERF_SIZES) {
    describe(`dataset ${size}`, () => {
      const spec = PERF_SIZE_SPECS[size];
      let measurements: Partial<Record<PerfQueryName, Measurement>> = {};

      beforeAll(async () => {
        const dataset = datasets[size];
        measurements = {};

        for (const query of [
          'oneRmWeekly',
          'volumeWeekly',
          'volumeTotalWeekly',
          'caloriesWeekly',
          'forgottenMuscles',
          'exerciseTrend',
          'dashboard',
        ] as PerfQueryName[]) {
          const measurement = await measure(harness, dataset, query);
          measurements[query] = measurement;
          // eslint-disable-next-line no-console
          console.log(
            `[perf] ${size.padEnd(6)} ${query.padEnd(18)} ` +
              `queries=${String(measurement.queries).padStart(2)} ` +
              `roundTrips=${String(measurement.roundTrips).padStart(2)} ` +
              `docs=${String(measurement.docsReturned).padStart(4)} ` +
              `median=${String(measurement.medianMs).padStart(8)}ms ` +
              `results=${measurement.resultCount}`,
          );
        }

        report.sizes[size] = {
          historyDays: spec.historyDays,
          windowDays: spec.windowDays,
          window: { from: dataset.from, to: dataset.to },
          dataset: dataset.counts,
          queries: measurements as Record<PerfQueryName, Measurement>,
        };
      }, 180_000);

      it('produces non-empty results so the compute path is really exercised', () => {
        expect(measurements.oneRmWeekly?.resultCount ?? 0).toBeGreaterThan(0);
        expect(measurements.volumeWeekly?.resultCount ?? 0).toBeGreaterThan(0);
        expect(
          measurements.volumeTotalWeekly?.resultCount ?? 0,
        ).toBeGreaterThan(0);
        expect(measurements.caloriesWeekly?.resultCount ?? 0).toBeGreaterThan(
          0,
        );
        expect(measurements.exerciseTrend?.resultCount ?? 0).toBeGreaterThan(0);
        expect(measurements.dashboard?.resultCount ?? 0).toBeGreaterThan(0);
      });

      it('flags the untrained planned muscle (forgotten-muscles output path)', () => {
        expect(measurements.forgottenMuscles?.resultCount ?? 0).toBeGreaterThan(
          0,
        );
      });

      for (const query of [
        'oneRmWeekly',
        'volumeWeekly',
        'volumeTotalWeekly',
        'caloriesWeekly',
        'forgottenMuscles',
        'exerciseTrend',
        'dashboard',
      ] as PerfQueryName[]) {
        describe(query, () => {
          it('issues exactly the budgeted number of queries', () => {
            expect(measurements[query]?.queries).toBe(
              budgetFor(size, query).queries,
            );
          });

          it('materializes exactly the budgeted number of documents', () => {
            expect(measurements[query]?.docsReturned).toBe(
              budgetFor(size, query).docsReturned,
            );
          });

          if (PERF_TIMING_ENFORCED) {
            it('stays within the elapsed budget', () => {
              expect(measurements[query]?.medianMs ?? Infinity).toBeLessThan(
                PERF_ELAPSED_BUDGET_MS[query],
              );
            });
          }
        });
      }
    });
  }

  describe('TEST-005 — window-bounded vs history-bounded reads', () => {
    it('grows getStatsCaloriesWeekly with history length, not window length', () => {
      const medium = report.sizes.medium.queries.caloriesWeekly.docsReturned;
      const large = report.sizes.large.queries.caloriesWeekly.docsReturned;
      expect(large).toBeGreaterThan(medium);
    });

    it('leaves getStatsVolumeTotalWeekly independent of history length', () => {
      expect(report.sizes.large.queries.volumeTotalWeekly.docsReturned).toBe(
        report.sizes.medium.queries.volumeTotalWeekly.docsReturned,
      );
    });

    it('leaves every other query independent of history length', () => {
      for (const query of [
        'oneRmWeekly',
        'volumeWeekly',
        'forgottenMuscles',
        'exerciseTrend',
      ] as PerfQueryName[]) {
        expect(report.sizes.large.queries[query].docsReturned).toBe(
          report.sizes.medium.queries[query].docsReturned,
        );
      }
    });
  });

  afterAll(() => {
    writeReport();
  });
});
