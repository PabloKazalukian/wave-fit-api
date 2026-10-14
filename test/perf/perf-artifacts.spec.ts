import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { PERF_SIZES } from './fixtures/perf-dataset';

/**
 * Contract tests for the k6 layer (`FR-009`, `FR-010`, `NFR-006`, `TEST-007`).
 *
 * These do not run k6 against a live API — that requires a running server and a
 * seeded database. They assert the *contract* of the script: that it parses with
 * the real k6 binary, that all seven scenarios and both thresholds are declared,
 * that credentials come from `__ENV`, and that no literal password is committed.
 */

const K6_SCRIPT = join(__dirname, '..', 'load', 'stats-charts.js');
const scriptSource = readFileSync(K6_SCRIPT, 'utf8');
const SEED_SCRIPT = join(__dirname, '..', '..', 'scripts', 'perf', 'seed-stats-charts.ts');
const seedSource = readFileSync(SEED_SCRIPT, 'utf8');

const CHARTS = [
  'getStats1RmWeekly',
  'getStatsVolumeWeekly',
  'getStatsVolumeTotalWeekly',
  'getStatsCaloriesWeekly',
  'getStatsForgottenMuscles',
  'getStatsExerciseTrend',
] as const;

describe('k6 contract (test/load/stats-charts.js)', () => {
  it('parses with the k6 binary and declares all seven scenarios', () => {
    let inspected: string;
    try {
      inspected = execFileSync('k6', ['inspect', K6_SCRIPT], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      // Only a *missing binary* may skip this: k6 is an external tool and need
      // not be installed on a contributor machine. A script that k6 refuses to
      // parse must fail loudly — returning early on every error would turn a
      // broken script into a green test, which is the one outcome this layer
      // exists to prevent.
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        console.warn(
          'k6 binary not available; skipping the inspect-based assertion.',
        );
        return;
      }
      throw err;
    }

    const scenarios = JSON.parse(inspected).scenarios as Record<
      string,
      { exec: string }
    >;
    const execFns = Object.values(scenarios).map((scenario) => scenario.exec);

    // Six charts plus the dashboard aggregate.
    expect(execFns).toHaveLength(6 + 1);
    expect(execFns).toEqual(
      expect.arrayContaining([
        'oneRmWeekly',
        'volumeWeekly',
        'volumeTotalWeekly',
        'caloriesWeekly',
        'forgottenMuscles',
        'exerciseTrend',
        'dashboard',
      ]),
    );
  });

  it('declares the two loose sanity thresholds', () => {
    expect(scriptSource).toContain("http_req_duration: ['p(95)<2000']");
    expect(scriptSource).toContain("http_req_failed: ['rate<0.01']");
  });

  /**
   * A 200 with no GraphQL error is not proof the run measured anything: if the
   * authenticated user owns no documents, every chart answers `[]` and the whole
   * suite reports green while timing an empty database. So the script must check
   * the payload and declare a `checks` threshold, without which even a failing
   * `check()` leaves the run green.
   */
  it('fails when a chart returns no data rather than timing an empty response', () => {
    expect(scriptSource).toContain("checks: ['rate>0.99']");
    expect(scriptSource).toContain('returned the seeded data');
    // Every chart declares which response field must carry the seeded data.
    for (const chart of CHARTS) {
      expect(scriptSource).toMatch(new RegExp(`${chart}: (true|false)`));
    }
  });

  it('queries every chart plus a single-request dashboard', () => {
    for (const chart of CHARTS) {
      expect(scriptSource).toContain(chart);
    }
    // The dashboard is the worst case: six sibling fields in one request, so
    // Apollo resolves them in parallel against the connection pool.
    expect(scriptSource).toMatch(/query Dashboard\(/);
    expect(scriptSource).toContain('DASHBOARD_QUERY');
  });

  it('reads credentials from the environment, never from a literal', () => {
    expect(scriptSource).toContain('__ENV.PERF_USER_EMAIL');
    expect(scriptSource).toContain('__ENV.PERF_USER_PASSWORD');
    expect(scriptSource).not.toMatch(/password:\s*['"]/);
  });

  it('authenticates with the HttpOnly cookie per ADR-0001', () => {
    // Same extraction as test/load/smoke.js: `token=` out of `set-cookie`.
    expect(scriptSource).toMatch(/token=\(\[\^;\]\+\)/);
    expect(scriptSource).toContain('Cookie: tokenCookie');
  });

  it('does not depend on the dead auth-smoke.js (BR-006)', () => {
    expect(scriptSource).not.toContain('auth-smoke');
  });

  // `NFR-006` covers the whole layer, not just the k6 script: the seed script
  // writes a real bcrypt login, so a committed default password there would be
  // just as much a leak as a literal in the k6 file.
  it('reads the perf user credentials from the environment, never from a literal', () => {
    expect(seedSource).toContain('process.env.PERF_USER_EMAIL');
    expect(seedSource).toContain('process.env.PERF_USER_PASSWORD');
    expect(seedSource).not.toMatch(/DEFAULT_(EMAIL|PASSWORD)/);
    expect(seedSource).not.toMatch(/password\s*=\s*['"][^'"]+['"]/i);
  });
});

describe('perf workflow contract (TEST-010)', () => {
  const workflowPath = join(
    __dirname,
    '..',
    '..',
    '.github',
    'workflows',
    'perf.yml',
  );

  it('runs only on schedule and workflow_dispatch', () => {
    const workflow = readFileSync(workflowPath, 'utf8');
    expect(workflow).toContain('schedule:');
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).not.toContain('pull_request');
    expect(workflow).not.toMatch(/^\s{2}push:/m);
  });

  it('asserts the deterministic budgets rather than timing', () => {
    const workflow = readFileSync(workflowPath, 'utf8');
    expect(workflow).toContain('jest --config test/jest-perf.json');
    // Timing must never be the thing that fails the job (BR-002).
    expect(workflow).not.toContain('PERF_ENFORCE_TIMING');
  });

  it('keeps the canonical PR gate untouched', () => {
    const ci = readFileSync(
      join(__dirname, '..', '..', '.github', 'workflows', 'ci.yml'),
      'utf8',
    );
    expect(ci).not.toContain('perf');
    expect(ci).not.toContain('jest-perf');
  });
});

describe('npm scripts (FR-011)', () => {
  const pkg = JSON.parse(
    readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'),
  );

  it('exposes test:perf, perf:seed and test:perf:k6', () => {
    expect(pkg.scripts['test:perf']).toContain('test/jest-perf.json');
    expect(pkg.scripts['perf:seed']).toContain(
      'scripts/perf/seed-stats-charts.ts',
    );
    expect(pkg.scripts['test:perf:k6']).toContain('test/load/stats-charts.js');
  });

  it('adds no dependency for the performance layer', () => {
    expect(pkg.dependencies.k6).toBeUndefined();
    expect(pkg.dependencies['mongodb-memory-server']).toBeUndefined();
    expect(pkg.devDependencies.k6).toBeUndefined();
  });
});

describe('suite isolation (TEST-001, FR-001)', () => {
  it('is not collected by the unit config', () => {
    // Required rather than JSON-parsed: `jest.config.js` is a CommonJS module
    // with trailing commas, which is not valid JSON.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const unit = require(join(__dirname, '..', '..', 'jest.config.js'));
    // `rootDir: 'src'` alone already excludes `test/perf/`, because it lives
    // outside `src/`. Asserted explicitly so the isolation has a guard.
    expect(unit.rootDir).toBe('src');
    expect(unit.testPathIgnorePatterns).not.toContain('test/perf');
    expect(JSON.stringify(unit)).not.toContain('jest-perf');
  });

  it('is not collected by the e2e config', () => {
    const e2e = readFileSync(join(__dirname, '..', 'jest-e2e.json'), 'utf8');
    expect(e2e).toContain('test/e2e');
    expect(e2e).not.toContain('test/perf');
  });

  it('is collected by the perf config', () => {
    const perf = JSON.parse(
      readFileSync(join(__dirname, '..', 'jest-perf.json'), 'utf8'),
    );
    expect(perf.testRegex).toContain('test/perf');
    expect(perf.maxWorkers).toBe(1);
  });

  it('does not include the perf layer in the dataset sizes', () => {
    expect(PERF_SIZES).toEqual(['small', 'medium', 'large']);
  });
});
