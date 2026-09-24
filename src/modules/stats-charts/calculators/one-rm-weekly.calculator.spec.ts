import { OneRmWeeklyCalculator } from './one-rm-weekly.calculator';
import { localDateToUtc, LocalDate } from '../../../common/utils/date.utils';
import { ChartWorkoutSession } from '../shared/chart.types';

const TIMEZONE = 'America/Argentina/Buenos_Aires';

function chainMock(resolvedValue: unknown) {
  const exec = jest.fn<any>().mockResolvedValue(resolvedValue);
  const lean = jest.fn<any>(() => ({ exec }));
  const sort = jest.fn<any>(() => ({ lean }));
  const find = jest.fn<any>(() => ({ sort }));
  return { find, sort, lean, exec };
}

function leanChainMock(resolvedValue: unknown) {
  const exec = jest.fn<any>().mockResolvedValue(resolvedValue);
  const lean = jest.fn<any>(() => ({ exec }));
  const find = jest.fn<any>(() => ({ lean }));
  return { find, lean, exec };
}

function session(
  id: string,
  date: LocalDate,
  exercises: { exerciseId: string; sets: { reps: number; weights?: number }[] }[],
): ChartWorkoutSession {
  return {
    _id: id,
    userId: 'user1',
    date: localDateToUtc(date, TIMEZONE),
    status: 'complete',
    exercises: exercises.map((e) => ({
      exerciseId: e.exerciseId,
      series: e.sets.length,
      sets: e.sets,
    })),
  };
}

const SQUAT = { _id: 'ex1', name: 'Squat', category: 'legs', usesWeight: true };
const BENCH = { _id: 'ex2', name: 'Bench Press', category: 'chest', usesWeight: true };

describe('OneRmWeeklyCalculator (stats-charts)', () => {
  let workoutMock: ReturnType<typeof chainMock>;
  let exerciseMock: ReturnType<typeof leanChainMock>;
  let calculator: OneRmWeeklyCalculator;

  beforeEach(() => {
    workoutMock = chainMock([]);
    exerciseMock = leanChainMock([SQUAT, BENCH]);
    calculator = new OneRmWeeklyCalculator(workoutMock as any, exerciseMock as any);
  });

  it('computes Epley 1RM from the best set of the week (not the average)', async () => {
    workoutMock.exec.mockResolvedValue([
      session('ws1', '2026-09-01', [
        { exerciseId: 'ex1', sets: [{ reps: 10, weights: 100 }, { reps: 5, weights: 150 }] },
      ]),
    ]);

    const result = await calculator.execute('user1', '2026-09-01', '2026-09-06', TIMEZONE);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      exerciseId: 'ex1',
      name: 'Squat',
      category: 'legs',
    });
    expect(result[0].weeks).toHaveLength(1);
    expect(result[0].weeks[0]).toMatchObject({
      weekKey: '2026-W36',
      weightUsed: 150,
      reps: 5,
      participated: true,
    });
    expect(result[0].weeks[0].best1RM).toBeCloseTo(175, 5);
  });

  it('uses the best set across multiple sessions in the same week', async () => {
    workoutMock.exec.mockResolvedValue([
      session('ws1', '2026-09-02', [
        { exerciseId: 'ex1', sets: [{ reps: 10, weights: 100 }, { reps: 5, weights: 150 }] },
      ]),
      session('ws2', '2026-09-04', [
        { exerciseId: 'ex1', sets: [{ reps: 3, weights: 160 }] },
      ]),
    ]);

    const result = await calculator.execute('user1', '2026-09-01', '2026-09-06', TIMEZONE);

    expect(result[0].weeks[0]).toMatchObject({ best1RM: 176, weightUsed: 160, reps: 3 });
  });

  it('ignores weightless sets, zero-weight sets and reps above the 1RM cap', async () => {
    workoutMock.exec.mockResolvedValue([
      session('ws1', '2026-09-01', [
        {
          exerciseId: 'ex1',
          sets: [
            { reps: 10, weights: undefined },
            { reps: 15, weights: 80 },
            { reps: 10, weights: 0 },
            { reps: 8, weights: 60 },
          ],
        },
      ]),
    ]);

    const result = await calculator.execute('user1', '2026-09-01', '2026-09-06', TIMEZONE);

    expect(result).toHaveLength(1);
    expect(result[0].weeks[0]).toMatchObject({ weightUsed: 60, reps: 8, participated: true });
    expect(result[0].weeks[0].best1RM).toBeCloseTo(76, 5);
  });

  it('emits all weeks of the window, with gaps as null and participated false', async () => {
    workoutMock.exec.mockResolvedValue([
      session('ws1', '2026-09-01', [
        { exerciseId: 'ex1', sets: [{ reps: 5, weights: 150 }] },
      ]),
    ]);

    const result = await calculator.execute('user1', '2026-09-01', '2026-09-21', TIMEZONE);

    expect(result[0].weeks.map((w) => w.weekKey)).toEqual([
      '2026-W36',
      '2026-W37',
      '2026-W38',
      '2026-W39',
    ]);
    expect(result[0].weeks[0].participated).toBe(true);
    for (const week of result[0].weeks.slice(1)) {
      expect(week).toMatchObject({ best1RM: null, weightUsed: null, reps: null, participated: false });
    }
  });

  it('excludes exercises with no eligible set across the window', async () => {
    workoutMock.exec.mockResolvedValue([
      session('ws1', '2026-09-01', [
        { exerciseId: 'ex1', sets: [{ reps: 15, weights: 80 }, { reps: 10, weights: 0 }] },
      ]),
    ]);

    const result = await calculator.execute('user1', '2026-09-01', '2026-09-06', TIMEZONE);

    expect(result).toHaveLength(0);
  });

  it('queries only complete, non-deleted sessions within the window bounds', async () => {
    workoutMock.exec.mockResolvedValue([]);

    await calculator.execute('user1', '2026-09-01', '2026-09-06', TIMEZONE);

    const query = workoutMock.find.mock.calls[0][0];
    expect(query.userId.toString()).toBe('user1');
    expect(query.deleted).toEqual({ $ne: true });
    expect(query.status).toBe('complete');
    expect(query.date.$gte.toISOString()).toBe('2026-09-01T03:00:00.000Z');
    expect(query.date.$lt.toISOString()).toBe('2026-09-07T03:00:00.000Z');
    expect(workoutMock.sort).toHaveBeenCalledWith({ date: 1 });
  });

  it('orders output deterministically by exercise name', async () => {
    workoutMock.exec.mockResolvedValue([
      session('ws1', '2026-09-01', [
        { exerciseId: 'ex1', sets: [{ reps: 5, weights: 150 }] },
        { exerciseId: 'ex2', sets: [{ reps: 5, weights: 100 }] },
      ]),
    ]);

    const result = await calculator.execute('user1', '2026-09-01', '2026-09-06', TIMEZONE);

    expect(result.map((r) => r.name)).toEqual(['Bench Press', 'Squat']);
  });
});
