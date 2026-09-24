import { ForgottenMusclesCalculator } from './forgotten-muscles.calculator';
import { localDateToUtc, LocalDate } from '../../../common/utils/date.utils';
import { ExerciseCategory } from '../../routines/templates/exercise/entities/exercise.entity';

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
const CURL = { _id: 'ex3', name: 'Curl', category: 'biceps', usesWeight: true };

describe('ForgottenMusclesCalculator (stats-charts)', () => {
  let workoutMock: ReturnType<typeof chainMock>;
  let exerciseMock: ReturnType<typeof leanChainMock>;
  let weekLogMock: ReturnType<typeof leanChainMock>;
  let dayLogMock: ReturnType<typeof leanChainMock>;
  let routinePlanMock: ReturnType<typeof leanChainMock>;
  let routineDayMock: ReturnType<typeof leanChainMock>;
  let calculator: ForgottenMusclesCalculator;

  beforeEach(() => {
    workoutMock = chainMock([]);
    exerciseMock = leanChainMock([SQUAT, BENCH, CURL]);
    weekLogMock = leanChainMock([]);
    dayLogMock = leanChainMock([]);
    routinePlanMock = leanChainMock([]);
    routineDayMock = leanChainMock([]);
    calculator = new ForgottenMusclesCalculator(
      workoutMock as any,
      exerciseMock as any,
      weekLogMock as any,
      dayLogMock as any,
      routinePlanMock as any,
      routineDayMock as any,
    );
  });

  it('derives expected muscles from the active WeekLog plan and flags those below the threshold', async () => {
    weekLogMock.exec.mockResolvedValue([
      { _id: 'wl1', userId: USER_ID, planId: 'p1', active: true },
    ]);
    routinePlanMock.exec.mockResolvedValue([
      {
        _id: 'p1',
        week: [
          { day: 'rd1', order: 1, isRest: false },
          { day: 'rd2', order: 2, isRest: true },
        ],
      },
    ]);
    routineDayMock.exec.mockResolvedValue([
      { _id: 'rd1', title: 'Push', type: [ExerciseCategory.CHEST, ExerciseCategory.BACK] },
    ]);
    workoutMock.exec.mockResolvedValue([
      session('ws1', '2026-09-01', [
        { exerciseId: 'ex2', sets: [{ reps: 8, weights: 80 }] },
      ]),
    ]);

    const result = await calculator.execute(
      USER_ID,
      '2026-09-01',
      '2026-09-06',
      TIMEZONE,
    );

    // 1 window week → threshold = 2 sets. chest (1) and back (0) are both flagged.
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      muscle: ExerciseCategory.BACK,
      totalSets: 0,
      weeksWithoutWork: 1,
      lastTrainedAt: null,
    });
    expect(result[1]).toMatchObject({
      muscle: ExerciseCategory.CHEST,
      totalSets: 1,
      weeksWithoutWork: 0,
    });
    expect(result[1].lastTrainedAt!.toISOString()).toBe(
      localDateToUtc('2026-09-01', TIMEZONE).toISOString(),
    );
  });

  it('derives expected muscles from an active DayLog routineDayId', async () => {
    dayLogMock.exec.mockResolvedValue([
      { _id: 'dl1', userId: USER_ID, routineDayId: 'rd9', active: true },
    ]);
    routineDayMock.exec.mockResolvedValue([
      { _id: 'rd9', title: 'Arms', type: [ExerciseCategory.BICEPS] },
    ]);
    workoutMock.exec.mockResolvedValue([
      session('ws1', '2026-09-02', [
        { exerciseId: 'ex1', sets: [{ reps: 5, weights: 100 }, { reps: 5, weights: 100 }] },
      ]),
    ]);

    const result = await calculator.execute(
      USER_ID,
      '2026-09-01',
      '2026-09-06',
      TIMEZONE,
    );

    // legs (2 sets) reaches the threshold and is not reported; biceps (0) is.
    expect(result).toEqual([
      {
        muscle: ExerciseCategory.BICEPS,
        totalSets: 0,
        weeksWithoutWork: 1,
        lastTrainedAt: null,
      },
    ]);
    expect(dayLogMock.find.mock.calls[0][0].active).toBe(true);
  });

  it('falls back to the full catalog (excluding REST) when there is no active plan', async () => {
    workoutMock.exec.mockResolvedValue([]);

    const result = await calculator.execute(
      USER_ID,
      '2026-09-01',
      '2026-09-06',
      TIMEZONE,
    );

    const muscles = result.map((r) => r.muscle);
    expect(muscles).not.toContain(ExerciseCategory.REST);
    expect(new Set(muscles).size).toBe(10);
    for (const category of Object.values(ExerciseCategory)) {
      if (category === ExerciseCategory.REST) continue;
      expect(muscles).toContain(category);
    }
    expect(weekLogMock.find.mock.calls[0][0]).toMatchObject({
      userId: USER_ID,
      active: true,
      deleted: { $ne: true },
    });
    expect(dayLogMock.find.mock.calls[0][0]).toMatchObject({
      userId: USER_ID,
      active: true,
      deleted: { $ne: true },
    });
  });

  it('counts weeksWithoutWork and keeps the most recent trained date', async () => {
    weekLogMock.exec.mockResolvedValue([
      { _id: 'wl1', userId: USER_ID, planId: 'p1', active: true },
    ]);
    routinePlanMock.exec.mockResolvedValue([
      { _id: 'p1', week: [{ day: 'rd1', order: 1, isRest: false }] },
    ]);
    routineDayMock.exec.mockResolvedValue([
      { _id: 'rd1', title: 'Push', type: [ExerciseCategory.CHEST] },
    ]);
    workoutMock.exec.mockResolvedValue([
      session('ws1', '2026-09-02', [
        { exerciseId: 'ex2', sets: [{ reps: 8, weights: 80 }, { reps: 8, weights: 80 }] },
      ]),
      session('ws2', '2026-09-16', [
        { exerciseId: 'ex2', sets: [{ reps: 8, weights: 80 }] },
      ]),
    ]);

    const result = await calculator.execute(
      USER_ID,
      '2026-09-01',
      '2026-09-20',
      TIMEZONE,
    );

    // W36..W38 (3 weeks). chest trained W36 (2 sets) and W38 (1 set) → total 3 < 6.
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      muscle: ExerciseCategory.CHEST,
      totalSets: 3,
      weeksWithoutWork: 1,
    });
    expect(result[0].lastTrainedAt!.toISOString()).toBe(
      localDateToUtc('2026-09-16', TIMEZONE).toISOString(),
    );
  });

  it('orders by totalSets asc, then weeksWithoutWork desc, then lastTrainedAt asc', async () => {
    weekLogMock.exec.mockResolvedValue([
      { _id: 'wl1', userId: USER_ID, planId: 'p1', active: true },
    ]);
    routinePlanMock.exec.mockResolvedValue([
      { _id: 'p1', week: [{ day: 'rd1', order: 1, isRest: false }] },
    ]);
    routineDayMock.exec.mockResolvedValue([
      {
        _id: 'rd1',
        title: 'Full',
        type: [
          ExerciseCategory.CHEST,
          ExerciseCategory.BACK,
          ExerciseCategory.BICEPS,
          ExerciseCategory.LEGS,
        ],
      },
    ]);
    workoutMock.exec.mockResolvedValue([
      session('ws1', '2026-09-02', [
        { exerciseId: 'ex2', sets: [{ reps: 8, weights: 80 }] },
      ]),
      session('ws2', '2026-09-03', [
        { exerciseId: 'ex1', sets: [{ reps: 8, weights: 80 }] },
      ]),
      session('ws3', '2026-09-09', [
        { exerciseId: 'ex1', sets: [{ reps: 8, weights: 80 }] },
        { exerciseId: 'ex3', sets: [{ reps: 10, weights: 20 }, { reps: 10, weights: 20 }] },
      ]),
    ]);

    const result = await calculator.execute(
      USER_ID,
      '2026-09-01',
      '2026-09-13',
      TIMEZONE,
    );

    // 2 weeks → threshold 4. back: 0 sets, chest: 1 (W36), biceps: 2 (W37), legs: 2 (W36+W37).
    // Order: totalSets asc → weeksWithoutWork desc → lastTrainedAt asc.
    expect(result.map((r) => r.muscle)).toEqual([
      ExerciseCategory.BACK,
      ExerciseCategory.CHEST,
      ExerciseCategory.BICEPS,
      ExerciseCategory.LEGS,
    ]);
    expect(result[0].weeksWithoutWork).toBe(2);
    expect(result[1].weeksWithoutWork).toBe(1);
    expect(result[2].weeksWithoutWork).toBe(1);
    expect(result[3].weeksWithoutWork).toBe(0);
  });

  it('scopes sessions to completed non-deleted records in the window', async () => {
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

  it('only queries routine plans and days that are reachable from active logs', async () => {
    weekLogMock.exec.mockResolvedValue([]);
    dayLogMock.exec.mockResolvedValue([]);

    await calculator.execute(USER_ID, '2026-09-01', '2026-09-06', TIMEZONE);

    expect(routinePlanMock.find).not.toHaveBeenCalled();
    expect(routineDayMock.find).not.toHaveBeenCalled();
  });
});