import { Types } from 'mongoose';
import { fromZonedTime } from 'date-fns-tz';
import {
  addDaysToLocalDate,
  isValidLocalDate,
  type LocalDate,
} from '../../../src/common/utils/date.utils';
import {
  EXTRA_SESSION_DISCIPLINES,
  ExtraSessionCategory,
  type ExtraSessionDisciplineKey,
} from '../../../src/modules/routines/tracking/extra-session/extra-session.catalog';
import { ExerciseCategory } from '../../../src/modules/routines/templates/exercise/entities/exercise.entity';
import { Gender } from '../../../src/modules/user/user-profile/schema/user-profile.schema';
import { SEEDED_EXERCISES } from '../../../src/database/seeds/routines.seed';

/**
 * Deterministic dataset generator for the `stats-charts` performance layer.
 *
 * Reproducibility is a hard requirement (`BR-005`): the bench asserts exact
 * integer budgets, which are only meaningful if two runs produce the same
 * documents. Therefore this module never calls `Math.random()` and never calls
 * `new Date()` — every value derives from the fixed anchor and a seeded PRNG.
 */

export const PERF_TIMEZONE = 'America/Argentina/Buenos_Aires';

/**
 * Fixed anchor (the window's `to`). A constant, not "today": a dataset that
 * moves with the wall clock cannot be compared across runs or across machines.
 */
export const PERF_ANCHOR: LocalDate = '2026-09-27';

export const PERF_SIZES = ['small', 'medium', 'large'] as const;
export type PerfSize = (typeof PERF_SIZES)[number];

export interface PerfSizeSpec {
  /** Total calendar span covered by the dataset, ending at the anchor. */
  historyDays: number;
  /** Width of the measured stats-charts window. Never above the 120-day cap. */
  windowDays: number;
  /** Sessions placed inside the window. */
  windowSessions: number;
  /** Sessions placed strictly before the window. */
  historySessions: number;
  /** Extra sessions placed inside the window. */
  windowExtras: number;
  /** Extra sessions placed strictly before the window. */
  historyExtras: number;
  /** One weigh-in every 7 days across the whole history. */
  expectedWeightLogs: number;
}

export const PERF_SIZE_SPECS: Record<PerfSize, PerfSizeSpec> = {
  small: {
    historyDays: 28,
    windowDays: 28,
    windowSessions: 12,
    historySessions: 0,
    windowExtras: 4,
    historyExtras: 0,
    expectedWeightLogs: 5,
  },
  medium: {
    historyDays: 120,
    windowDays: 120,
    windowSessions: 68,
    historySessions: 0,
    windowExtras: 17,
    historyExtras: 0,
    expectedWeightLogs: 18,
  },
  large: {
    historyDays: 546,
    windowDays: 120,
    windowSessions: 68,
    historySessions: 244,
    windowExtras: 17,
    historyExtras: 61,
    expectedWeightLogs: 79,
  },
};

export const PERF_EXERCISES = SEEDED_EXERCISES.map((exercise) => ({
  name: exercise.name,
  category: exercise.category,
  usesWeight: exercise.usesWeight,
}));

export const PERF_ROUTINE_DAY_TITLES = [
  'Push A',
  'Pull A',
  'Legs A',
  'Push B',
  'Pull B',
  'Legs B',
];

/** Muscle groups each routine day trains — drives the expected-muscle union. */
const ROUTINE_DAY_TYPES: Record<string, ExerciseCategory[]> = {
  'Push A': [
    ExerciseCategory.CHEST,
    ExerciseCategory.SHOULDERS,
    ExerciseCategory.TRICEPS,
  ],
  'Pull A': [ExerciseCategory.BACK, ExerciseCategory.BICEPS],
  'Legs A': [
    ExerciseCategory.LEGS_FRONT,
    ExerciseCategory.LEGS_POSTERIOR,
    ExerciseCategory.CORE,
  ],
  'Push B': [
    ExerciseCategory.CHEST,
    ExerciseCategory.SHOULDERS,
    ExerciseCategory.TRICEPS,
  ],
  'Pull B': [ExerciseCategory.BACK, ExerciseCategory.BICEPS],
  'Legs B': [
    ExerciseCategory.LEGS_FRONT,
    ExerciseCategory.LEGS_POSTERIOR,
    ExerciseCategory.LEGS,
    ExerciseCategory.CORE,
  ],
};

const DISCIPLINE_KEYS = Object.keys(
  EXTRA_SESSION_DISCIPLINES,
) as ExtraSessionDisciplineKey[];

/**
 * Exercises the generated sessions actually train.
 *
 * `core` is deliberately left out: the active plan expects it (Legs A/B
 * include CORE), so the dataset reproduces a realistic user who skips a planned
 * muscle. Without this, `forgotten-muscles` would correctly return an empty
 * list and its output-building path would never be measured.
 */
const TRAINED_CATEGORIES = new Set<ExerciseCategory>([ExerciseCategory.CORE]);

export interface PerfExerciseDoc {
  _id: Types.ObjectId;
  name: string;
  normalizedName: string;
  description: string;
  category: ExerciseCategory;
  usesWeight: boolean;
}

export interface PerfWorkoutSessionDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  weekLogId: Types.ObjectId;
  dayLogId: Types.ObjectId;
  routineDayId: Types.ObjectId;
  date: Date;
  exercises: {
    exerciseId: Types.ObjectId;
    series: number;
    sets: { reps: number; weights?: number }[];
  }[];
  status: string;
  notes: string;
  edited: boolean;
  deleted: boolean;
}

export interface PerfExtraSessionDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  workoutSessionId: Types.ObjectId;
  category: ExtraSessionCategory;
  discipline: ExtraSessionDisciplineKey;
  date: Date;
  duration: number;
  intensityLevel: number;
  calories?: number | null;
  notes: string;
}

export interface PerfUserWeightLogDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  weightKg: number;
  bodyFatPct: number;
  loggedAt: Date;
  notes: string;
}

export interface PerfUserProfileDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  gender: Gender;
  heightCm: number;
  weightKg: number;
  bodyFatPct: number;
  unitsPreference: string;
  distributionDays: string;
}

export interface PerfRoutineDayDoc {
  _id: Types.ObjectId;
  title: string;
  type: ExerciseCategory[];
  exercises: { exercise: Types.ObjectId; order: number }[];
}

export interface PerfRoutinePlanDoc {
  _id: Types.ObjectId;
  name: string;
  description: string;
  weekly_distribution: string;
  week: { day?: Types.ObjectId; isRest: boolean; order: number }[];
}

export interface PerfWeekLogDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  startDate: Date;
  endDate: Date;
  planId: Types.ObjectId;
  days: {
    order: number;
    date: Date;
    isRest: boolean;
    status: string;
  }[];
  completed: boolean;
  active: boolean;
  notes: string;
  deleted: boolean;
}

export interface PerfDayLogDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  date: Date;
  planId: Types.ObjectId;
  routineDayId: Types.ObjectId;
  status: string;
  active: boolean;
  completed: boolean;
  notes: string;
  deleted: boolean;
}

export interface PerfDataset {
  size: PerfSize;
  userId: string;
  email: string;
  timezone: string;
  /** Oldest date covered by the dataset. */
  historyStart: LocalDate;
  /** Window bounds, ready to use as a `StatsChartsInput`. */
  from: LocalDate;
  to: LocalDate;
  fromUtc: Date;
  toUtc: Date;
  exercises: PerfExerciseDoc[];
  workoutSessions: PerfWorkoutSessionDoc[];
  extraSessions: PerfExtraSessionDoc[];
  userWeightLogs: PerfUserWeightLogDoc[];
  userProfiles: PerfUserProfileDoc[];
  routineDays: PerfRoutineDayDoc[];
  routinePlan: PerfRoutinePlanDoc;
  weekLog: PerfWeekLogDoc;
  dayLog: PerfDayLogDoc;
  /** Counts the budget assertions are derived from. */
  counts: {
    exercises: number;
    workoutSessions: number;
    inWindowSessions: number;
    extraSessions: number;
    inWindowExtras: number;
    userWeightLogs: number;
    routineDays: number;
    activePlanDays: number;
  };
}

/** mulberry32 — small, fast, fully deterministic from an integer seed. */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fnv1a(text: string): number {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

/** Stable ObjectId from a label — same label always yields the same id. */
export function stableObjectId(label: string): Types.ObjectId {
  const forward = fnv1a(label);
  const reverse = fnv1a(label.split('').reverse().join(''));
  const mixed = (forward ^ reverse) >>> 0;
  const hex =
    forward.toString(16).padStart(8, '0') +
    reverse.toString(16).padStart(8, '0') +
    mixed.toString(16).padStart(8, '0');
  return new Types.ObjectId(hex);
}

function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}

function localMoment(localDate: LocalDate, hour: number, minute: number): Date {
  const [year, month, day] = localDate.split('-').map(Number);
  const pad = (value: number) => String(value).padStart(2, '0');
  return fromZonedTime(
    `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:00`,
    PERF_TIMEZONE,
  );
}

function buildExercises(): PerfExerciseDoc[] {
  // Size-independent on purpose: `exercises` is a global catalog shared by every
  // user, so all three dataset sizes must generate byte-identical documents and
  // be inserted only once.
  return PERF_EXERCISES.map((exercise) => ({
    _id: stableObjectId(`exercise:${exercise.name}`),
    name: exercise.name,
    normalizedName: exercise.name.toLowerCase(),
    description: 'Perf dataset exercise',
    category: exercise.category,
    usesWeight: exercise.usesWeight,
  }));
}

function buildRoutineDays(): PerfRoutineDayDoc[] {
  return PERF_ROUTINE_DAY_TITLES.map((title, index) => ({
    _id: stableObjectId(`routineDay:${title}`),
    title,
    type: ROUTINE_DAY_TYPES[title],
    exercises: PERF_EXERCISES.slice(index, index + 4).map(
      (exercise, order) => ({
        exercise: stableObjectId(`exercise:${exercise.name}`),
        order: order + 1,
      }),
    ),
  }));
}

function buildRoutinePlan(days: PerfRoutineDayDoc[]): PerfRoutinePlanDoc {
  return {
    _id: stableObjectId('routinePlan:perf-ppl'),
    name: 'Perf PPL 6 días',
    description:
      'Plan activo usado por el dataset de performance de stats-charts.',
    weekly_distribution: '6',
    week: [
      { day: days[0]._id, isRest: false, order: 1 },
      { day: days[1]._id, isRest: false, order: 2 },
      { day: days[2]._id, isRest: false, order: 3 },
      { day: undefined, isRest: true, order: 4 },
      { day: days[3]._id, isRest: false, order: 5 },
      { day: days[4]._id, isRest: false, order: 6 },
      { day: days[5]._id, isRest: false, order: 7 },
    ],
  };
}

/**
 * Distributes `count` documents evenly and uniquely across `spanDays` days
 * starting at `startDate`. `count <= spanDays` guarantees strictly increasing,
 * collision-free day offsets.
 */
function spreadDayOffsets(
  count: number,
  spanDays: number,
  startDate: LocalDate,
): LocalDate[] {
  const dates: LocalDate[] = [];
  for (let i = 0; i < count; i++) {
    dates.push(
      addDaysToLocalDate(startDate, Math.floor((i * spanDays) / count)),
    );
  }
  return dates;
}

export function buildPerfDataset(size: PerfSize): PerfDataset {
  const spec = PERF_SIZE_SPECS[size];
  if (!isValidLocalDate(PERF_ANCHOR)) {
    throw new Error(`PERF_ANCHOR is not a valid LocalDate: ${PERF_ANCHOR}`);
  }

  const random = createSeededRandom(
    fnv1a(`stats-charts-perf:${size}:${PERF_ANCHOR}`),
  );

  const to = PERF_ANCHOR;
  const from = addDaysToLocalDate(to, -spec.windowDays);
  const historyStart = addDaysToLocalDate(to, -spec.historyDays);
  const toUtc = localMoment(to, 23, 59);
  const fromUtc = localMoment(from, 0, 0);

  const userId = stableObjectId(`user:${size}`).toString();
  const userObjectId = new Types.ObjectId(userId);

  const exercises = buildExercises();
  const trainedExercises = exercises.filter(
    (exercise) => !TRAINED_CATEGORIES.has(exercise.category),
  );
  const routineDays = buildRoutineDays();
  const routinePlan = buildRoutinePlan(routineDays);
  const nonRestDays = routinePlan.week.filter((d) => !d.isRest && d.day);

  // Active week log: the current week containing the anchor.
  const weekStart = addDaysToLocalDate(to, -6);
  const weekLog: PerfWeekLogDoc = {
    _id: stableObjectId(`weekLog:${size}`),
    userId: userObjectId,
    startDate: localMoment(weekStart, 0, 0),
    endDate: localMoment(addDaysToLocalDate(weekStart, 6), 23, 59),
    planId: routinePlan._id,
    days: Array.from({ length: 7 }, (_, index) => {
      const date = addDaysToLocalDate(weekStart, index);
      const isRest = index === 3;
      return {
        order: index + 1,
        date: localMoment(date, 0, 0),
        isRest,
        status: isRest ? 'skipped' : 'complete',
      };
    }),
    completed: false,
    active: true,
    notes: 'Perf week log',
    deleted: false,
  };

  // Active day log pointing at a routine day that belongs to the plan, so
  // `forgotten-muscles` resolves the active-plan path (`FR-004`).
  const dayLog: PerfDayLogDoc = {
    _id: stableObjectId(`dayLog:${size}`),
    userId: userObjectId,
    date: localMoment(to, 6, 0),
    planId: routinePlan._id,
    routineDayId: nonRestDays[0].day as Types.ObjectId,
    status: 'complete',
    active: true,
    completed: true,
    notes: 'Perf day log',
    deleted: false,
  };

  const historySpanDays = Math.max(0, spec.historyDays - spec.windowDays);
  const inWindowDates = spreadDayOffsets(
    spec.windowSessions,
    spec.windowDays,
    from,
  );
  const historyDates =
    spec.historySessions > 0
      ? spreadDayOffsets(spec.historySessions, historySpanDays, historyStart)
      : [];

  const sessionDates = [...historyDates, ...inWindowDates].sort();

  const workoutSessions: PerfWorkoutSessionDoc[] = sessionDates.map(
    (date, index) => {
      const routineDay = nonRestDays[index % nonRestDays.length];
      const exercisesPerSession = 3 + Math.floor(random() * 4);
      const sessionExercises: PerfWorkoutSessionDoc['exercises'] = [];

      for (let e = 0; e < exercisesPerSession; e++) {
        const exercise =
          trainedExercises[(index * 3 + e * 5) % trainedExercises.length];
        const setCount = 3 + Math.floor(random() * 3);
        const sets: { reps: number; weights?: number }[] = [];

        for (let s = 0; s < setCount; s++) {
          // Exercise the 1RM eligibility filter (`FR-006`): most sets are valid,
          // every fifth has reps > 12 and every seventh is bodyweight (no weight).
          const repsOverCap = s % 5 === 4;
          const bodyweight = s % 7 === 6;
          const reps = repsOverCap
            ? 13 + Math.floor(random() * 4)
            : 4 + Math.floor(random() * 9);
          const weights = bodyweight
            ? undefined
            : 20 + Math.floor(random() * 101) + (repsOverCap ? 0 : 0);

          sets.push(weights === undefined ? { reps } : { reps, weights });
        }

        sessionExercises.push({
          exerciseId: exercise._id,
          series: setCount,
          sets,
        });
      }

      return {
        _id: stableObjectId(`session:${size}:${date}`),
        userId: userObjectId,
        weekLogId: weekLog._id,
        dayLogId: dayLog._id,
        routineDayId: routineDay.day as Types.ObjectId,
        date: localMoment(date, 6 + (index % 14), (index * 7) % 60),
        exercises: sessionExercises,
        status: 'complete',
        notes: 'Perf session',
        edited: false,
        deleted: false,
      };
    },
  );

  const inWindowExtraDates = spreadDayOffsets(
    spec.windowExtras,
    spec.windowDays,
    from,
  );
  const historyExtraDates =
    spec.historyExtras > 0
      ? spreadDayOffsets(spec.historyExtras, historySpanDays, historyStart)
      : [];
  const extraDates = [...historyExtraDates, ...inWindowExtraDates].sort();

  const extraSessions: PerfExtraSessionDoc[] = extraDates.map((date, index) => {
    const discipline = pick(random, DISCIPLINE_KEYS);
    const config = EXTRA_SESSION_DISCIPLINES[discipline];
    // Every fourth extra session carries a manual override, so the
    // manual-vs-estimated split is exercised by the dataset.
    const manualOverride = index % 4 === 3;
    return {
      _id: stableObjectId(`extra:${size}:${date}`),
      userId: userObjectId,
      workoutSessionId: workoutSessions[index % workoutSessions.length]._id,
      category: config.category,
      discipline,
      date: localMoment(date, 19, 30),
      duration: 25 + Math.floor(random() * 50),
      intensityLevel: 1 + Math.floor(random() * 5),
      calories: manualOverride ? 180 + Math.floor(random() * 220) : null,
      notes: 'Perf extra session',
    };
  });

  const weightLogCount = Math.floor(spec.historyDays / 7) + 1;
  const userWeightLogs: PerfUserWeightLogDoc[] = Array.from(
    { length: weightLogCount },
    (_, index) => {
      const date = addDaysToLocalDate(historyStart, index * 7);
      return {
        _id: stableObjectId(`weightLog:${size}:${date}`),
        userId: userObjectId,
        // A slow upward drift plus small oscillation: realistic progression.
        weightKg:
          Math.round((72 + index * 0.05 + Math.sin(index / 3) * 0.8) * 10) / 10,
        bodyFatPct: Math.round((18 - index * 0.01) * 10) / 10,
        loggedAt: localMoment(date, 7, 15),
        notes: 'Perf weigh-in',
      };
    },
  );

  const userProfiles: PerfUserProfileDoc[] = [
    {
      _id: stableObjectId(`userProfile:${size}`),
      userId: userObjectId,
      gender: Gender.MALE,
      heightCm: 178,
      weightKg: 75,
      bodyFatPct: 16.5,
      unitsPreference: 'metric',
      distributionDays: 'week_log',
    },
  ];

  return {
    size,
    userId,
    email: `perf-${size}@wavefit.test`,
    timezone: PERF_TIMEZONE,
    historyStart,
    from,
    to,
    fromUtc,
    toUtc,
    exercises,
    workoutSessions,
    extraSessions,
    userWeightLogs,
    userProfiles,
    routineDays,
    routinePlan,
    weekLog,
    dayLog,
    counts: {
      exercises: exercises.length,
      workoutSessions: workoutSessions.length,
      inWindowSessions: inWindowDates.length,
      extraSessions: extraSessions.length,
      inWindowExtras: inWindowExtraDates.length,
      userWeightLogs: userWeightLogs.length,
      routineDays: routineDays.length,
      activePlanDays: nonRestDays.length,
    },
  };
}
