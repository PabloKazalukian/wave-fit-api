import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    one_rm_weekly: {
      executor: 'constant-arrival-rate',
      rate: 1,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 1,
      maxVUs: 2,
      exec: 'oneRmWeekly',
      tags: { chart: 'oneRmWeekly' },
    },
    volume_weekly: {
      executor: 'constant-arrival-rate',
      rate: 1,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 1,
      maxVUs: 2,
      exec: 'volumeWeekly',
      tags: { chart: 'volumeWeekly' },
    },
    volume_total_weekly: {
      executor: 'constant-arrival-rate',
      rate: 1,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 1,
      maxVUs: 2,
      exec: 'volumeTotalWeekly',
      tags: { chart: 'volumeTotalWeekly' },
    },
    calories_weekly: {
      executor: 'constant-arrival-rate',
      rate: 1,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 1,
      maxVUs: 2,
      exec: 'caloriesWeekly',
      tags: { chart: 'caloriesWeekly' },
    },
    forgotten_muscles: {
      executor: 'constant-arrival-rate',
      rate: 1,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 1,
      maxVUs: 2,
      exec: 'forgottenMuscles',
      tags: { chart: 'forgottenMuscles' },
    },
    exercise_trend: {
      executor: 'constant-arrival-rate',
      rate: 1,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 1,
      maxVUs: 2,
      exec: 'exerciseTrend',
      tags: { chart: 'exerciseTrend' },
    },
    dashboard: {
      executor: 'constant-arrival-rate',
      rate: 1,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 1,
      maxVUs: 2,
      exec: 'dashboard',
      tags: { chart: 'dashboard' },
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.01'],
    // Without a `checks` threshold a failing `check()` still leaves the run
    // green, which would let an empty database pass as a fast one.
    checks: ['rate>0.99'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/graphql';

export function setup() {
  const res = http.post(
    BASE_URL,
    JSON.stringify({
      query: `
        mutation Login($identifier: String!, $password: String!) {
          login(identifier: $identifier, password: $password)
        }
      `,
      variables: {
        identifier: __ENV.PERF_USER_EMAIL || __ENV.USER_EMAIL,
        password: __ENV.PERF_USER_PASSWORD || __ENV.USER_PASSWORD,
      },
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );

  check(res, {
    'Login OK': (r) =>
      r.status === 200 && JSON.parse(r.body)?.data?.login === true,
  });

  const setCookie =
    res.headers['set-cookie'] || res.headers['Set-Cookie'] || '';
  const match = setCookie.match(/token=([^;]+)/);
  if (!match) {
    throw new Error(
      'No token cookie received. Set PERF_USER_EMAIL/PERF_USER_PASSWORD.',
    );
  }
  return `token=${match[1]}`;
}

const ONE_RM_QUERY = `
  query GetStats1RmWeekly($input: StatsChartsInput!) {
    getStats1RmWeekly(input: $input) {
      exerciseId
      exerciseName
      weekKey
      best1RM
    }
  }
`;

const VOLUME_WEEKLY_QUERY = `
  query GetStatsVolumeWeekly($input: StatsChartsInput!) {
    getStatsVolumeWeekly(input: $input) {
      weekKey
      exercises { exerciseId exerciseName volumeKg }
      muscles { category sets volumeKg }
    }
  }
`;

const VOLUME_TOTAL_QUERY = `
  query GetStatsVolumeTotalWeekly($input: StatsChartsInput!) {
    getStatsVolumeTotalWeekly(input: $input) {
      weekKey
      totalVolumeKg
    }
  }
`;

const CALORIES_QUERY = `
  query GetStatsCaloriesWeekly($input: StatsChartsInput!) {
    getStatsCaloriesWeekly(input: $input) {
      weekKey
      extraKcal
      routineKcal
      totalKcal
    }
  }
`;

const FORGOTTEN_QUERY = `
  query GetStatsForgottenMuscles($input: StatsChartsInput!) {
    getStatsForgottenMuscles(input: $input) {
      muscle
      weeksWithoutWork
      lastTrainedDate
    }
  }
`;

const TREND_QUERY = `
  query GetStatsExerciseTrend($input: StatsChartsInput!) {
    getStatsExerciseTrend(input: $input) {
      exerciseId
      exerciseName
      current1RM
      previous1RM
      trend
    }
  }
`;

const DASHBOARD_QUERY = `
  query Dashboard($i1: StatsChartsInput!, $i2: StatsChartsInput!, $i3: StatsChartsInput!, $i4: StatsChartsInput!, $i5: StatsChartsInput!, $i6: StatsChartsInput!) {
    getStats1RmWeekly(input: $i1) { exerciseId weekKey best1RM }
    getStatsVolumeWeekly(input: $i2) { weekKey muscles { category volumeKg } }
    getStatsVolumeTotalWeekly(input: $i3) { weekKey totalVolumeKg }
    getStatsCaloriesWeekly(input: $i4) { weekKey totalKcal }
    getStatsForgottenMuscles(input: $i5) { muscle weeksWithoutWork }
    getStatsExerciseTrend(input: $i6) { exerciseId trend }
  }
`;

function pad(n) {
  return String(n).padStart(2, '0');
}

function buildInput() {
  const to = __ENV.PERF_ANCHOR || '2026-09-27';
  const window = parseInt(__ENV.PERF_WINDOW_DAYS || '28', 10);
  const fromDate = new Date(to);
  fromDate.setDate(fromDate.getDate() - (window - 1));
  const from = `${fromDate.getFullYear()}-${pad(fromDate.getMonth() + 1)}-${pad(fromDate.getDate())}`;
  const input = {
    from,
    to,
    timezone: __ENV.PERF_TIMEZONE || 'America/Argentina/Buenos_Aires',
  };
  return {
    input,
    i1: input,
    i2: input,
    i3: input,
    i4: input,
    i5: input,
    i6: input,
  };
}

function postQuery(tokenCookie, query, variables) {
  return http.post(BASE_URL, JSON.stringify({ query, variables }), {
    headers: {
      'Content-Type': 'application/json',
      Cookie: tokenCookie,
    },
  });
}

/**
 * Which response field carries each chart's data, and whether it must be
 * non-empty.
 *
 * Every chart but `forgottenMuscles` is guaranteed non-empty by the seeded
 * dataset, which always plants sessions inside the window, so an empty array
 * there means the authenticated user owns nothing — the defect these checks
 * exist to catch. `forgottenMuscles` is exempt from the non-empty rule because
 * its result depends on which muscles the active plan happens to schedule.
 */
const EXPECTED_FIELDS = {
  oneRmWeekly: { getStats1RmWeekly: true },
  volumeWeekly: { getStatsVolumeWeekly: true },
  volumeTotalWeekly: { getStatsVolumeTotalWeekly: true },
  caloriesWeekly: { getStatsCaloriesWeekly: true },
  forgottenMuscles: { getStatsForgottenMuscles: false },
  exerciseTrend: { getStatsExerciseTrend: true },
  dashboard: {
    getStats1RmWeekly: true,
    getStatsVolumeWeekly: true,
    getStatsVolumeTotalWeekly: true,
    getStatsCaloriesWeekly: true,
    getStatsForgottenMuscles: false,
    getStatsExerciseTrend: true,
  },
};

function checkOk(res, label) {
  const expected = EXPECTED_FIELDS[label];
  check(res, {
    [`${label} 200`]: (r) => r.status === 200,
    [`${label} no GraphQL errors`]: (r) => {
      const body = JSON.parse(r.body);
      return !body.errors || body.errors.length === 0;
    },
    // A 200 with no errors is not proof the run measured anything: an
    // authenticated user who owns no documents answers `[]` everywhere. Timing
    // that would report a fast, meaningless run, so the payload is checked too.
    [`${label} returned the seeded data`]: (r) => {
      const data = JSON.parse(r.body)?.data;
      if (!data || !expected) return false;
      return Object.entries(expected).every(([field, mustBeNonEmpty]) => {
        const value = data[field];
        if (!Array.isArray(value)) return false;
        return mustBeNonEmpty ? value.length > 0 : true;
      });
    },
  });
}

export function oneRmWeekly(tokenCookie) {
  const vars = buildInput();
  checkOk(
    postQuery(tokenCookie, ONE_RM_QUERY, { input: vars.input }),
    'oneRmWeekly',
  );
}

export function volumeWeekly(tokenCookie) {
  const vars = buildInput();
  checkOk(
    postQuery(tokenCookie, VOLUME_WEEKLY_QUERY, { input: vars.input }),
    'volumeWeekly',
  );
}

export function volumeTotalWeekly(tokenCookie) {
  const vars = buildInput();
  checkOk(
    postQuery(tokenCookie, VOLUME_TOTAL_QUERY, { input: vars.input }),
    'volumeTotalWeekly',
  );
}

export function caloriesWeekly(tokenCookie) {
  const vars = buildInput();
  checkOk(
    postQuery(tokenCookie, CALORIES_QUERY, { input: vars.input }),
    'caloriesWeekly',
  );
}

export function forgottenMuscles(tokenCookie) {
  const vars = buildInput();
  checkOk(
    postQuery(tokenCookie, FORGOTTEN_QUERY, { input: vars.input }),
    'forgottenMuscles',
  );
}

export function exerciseTrend(tokenCookie) {
  const vars = buildInput();
  checkOk(
    postQuery(tokenCookie, TREND_QUERY, { input: vars.input }),
    'exerciseTrend',
  );
}

export function dashboard(tokenCookie) {
  const vars = buildInput();
  checkOk(postQuery(tokenCookie, DASHBOARD_QUERY, vars), 'dashboard');
}
