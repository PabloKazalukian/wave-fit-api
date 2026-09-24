import { VolumeWeeklyCalculator } from './volume-weekly.calculator';
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

describe('VolumeWeeklyCalculator (stats-charts)', () => {
  let workoutMock: ReturnType<typeof chainMock>;
  let exerciseMock: ReturnType<typeof leanChainMock>;
  let calculator: VolumeWeeklyCalculator;

  beforeEach(() => {
    workoutMock = chainMock([]);
    exerciseMock = leanChainMock([SQUAT, BENCH]);
    calculator = new VolumeWeeklyCalculator(workoutMock as any, exerciseMock as any);
  });

  it('sums volume per exercise and per muscle over the week', async () => {
    workoutMock.exec.mockResolvedValue([
      session('ws1', '2026-09-01', [
        {
          exerciseId: 'ex1',
          sets: [
            { reps: 10, weights: 100 },
            { reps: 5, weights: 150 },
            { reps: 8, weights: 60 },
          ],
        },
        {
          exerciseId: 'ex2',
          sets: [{ reps: 8, weights: 80 }],
        },
      ]),
    ]);

    const result = await calculator.execute('user1', '2026-09-01', '2026-09-06', TIMEZONE);

    expect(result).toHaveLength(1);
    expect(result[0].weekKey).toBe('2026-W36');
    expect(result[0].exercises).toEqual([
      { exerciseId: 'ex2', name: 'Bench Press', category: 'chest', volume: 640 },
      { exerciseId: 'ex1', name: 'Squat', category: 'legs', volume: 2230 },
    ]);
    expect(result[0].muscles).toEqual([
      { muscle: 'chest', sets: 1, volume: 640 },
      { muscle: 'legs', sets: 3, volume: 2230 },
    ]);
  });

  it('treats weightless and zero-weight sets as zero volume, but still counts sets with reps >= 1', async () => {
    workoutMock.exec.mockResolvedValue([
      session('ws1', '2026-09-01', [
        {
          exerciseId: 'ex1',
          sets: [
            { reps: 10, weights: 100 },
            { reps: 8, weights: undefined },
            { reps: 6, weights: 0 },
            { reps: 0, weights: 120 },
          ],
        },
      ]),
    ]);

    const result = await calculator.execute('user1', '2026-09-01', '2026-09-06', TIMEZONE);

    expect(result[0].exercises[0]).toMatchObject({ volume: 1000 });
    // sets con reps >= 1: 10, 8 y 6 → 3 (el de reps 0 no cuenta)
    expect(result[0].muscles[0]).toMatchObject({ muscle: 'legs', sets: 3, volume: 1000 });
  });

  it('emits every week of the window, with empty exercises/muscles for data-less weeks', async () => {
    workoutMock.exec.mockResolvedValue([
      session('ws1', '2026-09-02', [
        { exerciseId: 'ex1', sets: [{ reps: 5, weights: 150 }] },
      ]),
    ]);

    const result = await calculator.execute('user1', '2026-09-01', '2026-09-13', TIMEZONE);

    expect(result.map((w) => w.weekKey)).toEqual(['2026-W36', '2026-W37']);
    expect(result[0].exercises[0].volume).toBe(750);
    expect(result[1]).toEqual({ weekKey: '2026-W37', exercises: [], muscles: [] });
  });

  it('queries only completed sessions within the window on the workoutsessions collection', async () => {
    workoutMock.exec.mockResolvedValue([]);

    await calculator.execute('user1', '2026-09-01', '2026-09-13', TIMEZONE);

    const query = workoutMock.find.mock.calls[0][0];
    expect(query.userId.toString()).toBe('user1');
    expect(query.deleted).toEqual({ $ne: true });
    expect(query.status).toBe('complete');
    expect(query.date.$gte.toISOString()).toBe('2026-09-01T03:00:00.000Z');
    expect(query.date.$lt.toISOString()).toBe('2026-09-14T03:00:00.000Z');
    expect(workoutMock.sort).toHaveBeenCalledWith({ date: 1 });
  });
});