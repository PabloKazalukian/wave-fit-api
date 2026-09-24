import { VolumeTotalWeeklyCalculator } from './volume-total.calculator';
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

describe('VolumeTotalWeeklyCalculator (stats-charts)', () => {
  let workoutMock: ReturnType<typeof chainMock>;
  let calculator: VolumeTotalWeeklyCalculator;

  beforeEach(() => {
    workoutMock = chainMock([]);
    calculator = new VolumeTotalWeeklyCalculator(workoutMock as any);
  });

  it('totals volume per week and computes deltaPct against the previous week', async () => {
    workoutMock.exec.mockResolvedValue([
      session('ws1', '2026-09-02', [
        { exerciseId: 'ex1', sets: [{ reps: 10, weights: 100 }, { reps: 5, weights: 200 }] },
      ]),
      session('ws2', '2026-09-08', [
        { exerciseId: 'ex1', sets: [{ reps: 10, weights: 200 }, { reps: 4, weights: 300 }] },
      ]),
    ]);

    const result = await calculator.execute('user1', '2026-09-01', '2026-09-13', TIMEZONE);

    expect(result).toEqual([
      { weekKey: '2026-W36', totalVolume: 2000, deltaPct: null, possibleDeload: false },
      { weekKey: '2026-W37', totalVolume: 3200, deltaPct: 60, possibleDeload: false },
    ]);
  });

  it('exposes null deltaPct when the previous week total is zero', async () => {
    workoutMock.exec.mockResolvedValue([
      session('ws1', '2026-09-02', [
        { exerciseId: 'ex1', sets: [{ reps: 10, weights: 200 }] },
      ]),
      session('ws2', '2026-09-15', [
        { exerciseId: 'ex1', sets: [{ reps: 5, weights: 200 }] },
      ]),
    ]);

    const result = await calculator.execute('user1', '2026-09-01', '2026-09-20', TIMEZONE);

    // W36 = 2000, W37 sin data (0) → delta = (0-2000)/2000*100 = -100, W38 prev = 0 → null
    expect(result).toEqual([
      { weekKey: '2026-W36', totalVolume: 2000, deltaPct: null, possibleDeload: false },
      { weekKey: '2026-W37', totalVolume: 0, deltaPct: -100, possibleDeload: true },
      { weekKey: '2026-W38', totalVolume: 1000, deltaPct: null, possibleDeload: false },
    ]);
  });

  it('flags possibleDeload only when deltaPct is not null and at or below -30', async () => {
    workoutMock.exec.mockResolvedValue([
      session('ws1', '2026-09-02', [
        { exerciseId: 'ex1', sets: [{ reps: 10, weights: 200 }] },
      ]),
      session('ws2', '2026-09-08', [
        { exerciseId: 'ex1', sets: [{ reps: 5, weights: 140 }] },
      ]),
    ]);

    const result = await calculator.execute('user1', '2026-09-01', '2026-09-13', TIMEZONE);

    // W36 = 2000, W37 = 700 → delta = (700-2000)/2000*100 = -65 ≤ -30
    expect(result[1]).toMatchObject({ weekKey: '2026-W37', totalVolume: 700, possibleDeload: true });
    // deload just above the threshold → false
    expect(result[0]).toMatchObject({ possibleDeload: false });
    expect(result[0].deltaPct).toBeNull();
  });

  it('computes deload free of floating-point drift at the -30 threshold', async () => {
    workoutMock.exec.mockResolvedValue([
      session('ws1', '2026-09-02', [
        { exerciseId: 'ex1', sets: [{ reps: 10, weights: 100 }] },
      ]),
      session('ws2', '2026-09-08', [
        { exerciseId: 'ex1', sets: [{ reps: 7, weights: 100 }] },
      ]),
    ]);

    const result = await calculator.execute('user1', '2026-09-01', '2026-09-13', TIMEZONE);

    // W36 = 1000, W37 = 700 → delta = -30 exacto
    expect(result[1]).toMatchObject({ totalVolume: 700, possibleDeload: true });
    expect(result[1].deltaPct).toBeCloseTo(-30, 5);
  });

  it('queries only completed sessions within the window', async () => {
    workoutMock.exec.mockResolvedValue([]);

    await calculator.execute('user1', '2026-09-01', '2026-09-13', TIMEZONE);

    const query = workoutMock.find.mock.calls[0][0];
    expect(query.userId.toString()).toBe('user1');
    expect(query.deleted).toEqual({ $ne: true });
    expect(query.status).toBe('complete');
    expect(query.date.$lt.toISOString()).toBe('2026-09-14T03:00:00.000Z');
    expect(workoutMock.sort).toHaveBeenCalledWith({ date: 1 });
  });
});