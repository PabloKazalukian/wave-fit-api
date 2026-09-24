import { TrendCalculator } from './trend.calculator';
import { localDateToUtc, LocalDate } from '../../../common/utils/date.utils';
import { TrendLabel } from '../presentation/entities/exercise-trend.output';

const TIMEZONE = 'America/Argentina/Buenos_Aires';
const USER_ID = 'user1';

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
) {
  return {
    _id: id,
    userId: USER_ID,
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

describe('TrendCalculator (stats-charts)', () => {
  let workoutMock: ReturnType<typeof chainMock>;
  let exerciseMock: ReturnType<typeof leanChainMock>;
  let calculator: TrendCalculator;

  beforeEach(() => {
    workoutMock = chainMock([]);
    exerciseMock = leanChainMock([SQUAT, BENCH]);
    calculator = new TrendCalculator(workoutMock as any, exerciseMock as any);
  });

  it('regresses over the weekly best 1RM (least squares) and labels the trend up', async () => {
    workoutMock.exec.mockResolvedValue([
      session('ws1', '2026-09-01', [
        { exerciseId: 'ex2', sets: [{ reps: 10, weights: 90 }] },
      ]),
      session('ws2', '2026-09-08', [
        { exerciseId: 'ex2', sets: [{ reps: 10, weights: 100 }] },
      ]),
      session('ws3', '2026-09-15', [
        { exerciseId: 'ex2', sets: [{ reps: 10, weights: 110 }] },
      ]),
    ]);

    const result = await calculator.execute(
      USER_ID,
      '2026-09-01',
      '2026-09-20',
      TIMEZONE,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      exerciseId: 'ex2',
      name: 'Bench Press',
      category: 'chest',
      label: TrendLabel.UP,
      weeksUsed: 3,
    });
    // x=[0,1,2], y=[120,133.33,146.67] → slope ≈ 13.33, pctChange ≈ +10% (> +2%).
    expect(result[0].slope).toBeDefined();
    expect(result[0].slope!).toBeCloseTo(13.333, 1);
    expect(result[0].pctChange!).toBeCloseTo(10, 1);
  });

  it('labels a decreasing best-1RM series as down', async () => {
    workoutMock.exec.mockResolvedValue([
      session('ws1', '2026-09-01', [
        { exerciseId: 'ex1', sets: [{ reps: 5, weights: 100 }] },
      ]),
      session('ws2', '2026-09-08', [
        { exerciseId: 'ex1', sets: [{ reps: 5, weights: 90 }] },
      ]),
      session('ws3', '2026-09-15', [
        { exerciseId: 'ex1', sets: [{ reps: 5, weights: 80 }] },
      ]),
    ]);

    const result = await calculator.execute(
      USER_ID,
      '2026-09-01',
      '2026-09-20',
      TIMEZONE,
    );

    expect(result[0]).toMatchObject({
      label: TrendLabel.DOWN,
      weeksUsed: 3,
    });
    expect(result[0].slope!).toBeLessThan(0);
  });

  it('labels a within-threshold series as flat', async () => {
    workoutMock.exec.mockResolvedValue([
      session('ws1', '2026-09-01', [
        { exerciseId: 'ex1', sets: [{ reps: 10, weights: 90 }] },
      ]),
      session('ws2', '2026-09-08', [
        { exerciseId: 'ex1', sets: [{ reps: 10, weights: 91 }] },
      ]),
      session('ws3', '2026-09-15', [
        { exerciseId: 'ex1', sets: [{ reps: 10, weights: 89 }] },
      ]),
    ]);

    const result = await calculator.execute(
      USER_ID,
      '2026-09-01',
      '2026-09-20',
      TIMEZONE,
    );

    expect(result[0].label).toBe(TrendLabel.FLAT);
    expect(Math.abs(result[0].pctChange!)).toBeLessThan(2);
  });

  it('reports insufficient when fewer than 3 participated weeks exist', async () => {
    workoutMock.exec.mockResolvedValue([
      session('ws1', '2026-09-01', [
        { exerciseId: 'ex1', sets: [{ reps: 5, weights: 150 }] },
      ]),
      session('ws2', '2026-09-08', [
        { exerciseId: 'ex1', sets: [{ reps: 5, weights: 160 }] },
      ]),
      session('ws3', '2026-09-15', [
        // reps above the 1RM cap → the week does not participate
        { exerciseId: 'ex1', sets: [{ reps: 20, weights: 150 }] },
      ]),
    ]);

    const result = await calculator.execute(
      USER_ID,
      '2026-09-01',
      '2026-09-20',
      TIMEZONE,
    );

    expect(result[0]).toMatchObject({
      label: TrendLabel.INSUFFICIENT,
      slope: null,
      pctChange: null,
      weeksUsed: 2,
    });
  });

  it('uses the continuous window index as x when a week has no data', async () => {
    workoutMock.exec.mockResolvedValue([
      session('ws1', '2026-09-01', [
        { exerciseId: 'ex1', sets: [{ reps: 5, weights: 100 }] },
      ]),
      session('ws2', '2026-09-15', [
        { exerciseId: 'ex1', sets: [{ reps: 5, weights: 110 }] },
      ]),
      session('ws3', '2026-09-22', [
        { exerciseId: 'ex1', sets: [{ reps: 5, weights: 115 }] },
      ]),
    ]);

    const result = await calculator.execute(
      USER_ID,
      '2026-09-01',
      '2026-09-27',
      TIMEZONE,
    );

    // 4 weeks (W36..W39); data only in W36 (x=0), W38 (x=2), W39 (x=3).
    expect(result[0].weeksUsed).toBe(3);
    expect(result[0].slope!).toBeCloseTo(5.83, 2);
    expect(result[0].pctChange!).toBeCloseTo(4.62, 2);
  });

  it('orders output deterministically by exercise name', async () => {
    workoutMock.exec.mockResolvedValue([
      session('ws1', '2026-09-01', [
        { exerciseId: 'ex1', sets: [{ reps: 5, weights: 100 }] },
        { exerciseId: 'ex2', sets: [{ reps: 5, weights: 100 }] },
      ]),
      session('ws2', '2026-09-08', [
        { exerciseId: 'ex1', sets: [{ reps: 5, weights: 105 }] },
        { exerciseId: 'ex2', sets: [{ reps: 5, weights: 105 }] },
      ]),
      session('ws3', '2026-09-15', [
        { exerciseId: 'ex1', sets: [{ reps: 5, weights: 110 }] },
        { exerciseId: 'ex2', sets: [{ reps: 5, weights: 110 }] },
      ]),
    ]);

    const result = await calculator.execute(
      USER_ID,
      '2026-09-01',
      '2026-09-20',
      TIMEZONE,
    );

    expect(result.map((r) => r.name)).toEqual(['Bench Press', 'Squat']);
  });

  it('excludes exercises with no eligible set across the window', async () => {
    workoutMock.exec.mockResolvedValue([
      session('ws1', '2026-09-01', [
        { exerciseId: 'ex1', sets: [{ reps: 20, weights: 80 }, { reps: 10, weights: 0 }] },
      ]),
    ]);

    const result = await calculator.execute(
      USER_ID,
      '2026-09-01',
      '2026-09-06',
      TIMEZONE,
    );

    expect(result).toHaveLength(0);
  });

  it('queries only complete, non-deleted sessions within the window bounds', async () => {
    workoutMock.exec.mockResolvedValue([]);

    await calculator.execute(USER_ID, '2026-09-01', '2026-09-06', TIMEZONE);

    const query = workoutMock.find.mock.calls[0][0];
    expect(query.userId.toString()).toBe(USER_ID);
    expect(query.deleted).toEqual({ $ne: true });
    expect(query.status).toBe('complete');
    expect(query.date.$gte.toISOString()).toBe('2026-09-01T03:00:00.000Z');
    expect(query.date.$lt.toISOString()).toBe('2026-09-07T03:00:00.000Z');
    expect(workoutMock.sort).toHaveBeenCalledWith({ date: 1 });
  });
});