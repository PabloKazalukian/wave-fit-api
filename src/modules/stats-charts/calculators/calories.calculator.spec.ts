import { CaloriesCalculator } from './calories.calculator';
import { localDateToUtc, LocalDate } from '../../../common/utils/date.utils';

const TIMEZONE = 'America/Argentina/Buenos_Aires';
const USER_ID = 'user1';

function leanChainMock(resolvedValue: unknown) {
  const exec = jest.fn<any>().mockResolvedValue(resolvedValue);
  const lean = jest.fn<any>(() => ({ exec }));
  const find = jest.fn<any>(() => ({ lean }));
  return { find, lean, exec };
}

function sortedChainMock(resolvedValue: unknown) {
  const exec = jest.fn<any>().mockResolvedValue(resolvedValue);
  const lean = jest.fn<any>(() => ({ exec }));
  const sort = jest.fn<any>(() => ({ lean }));
  const find = jest.fn<any>(() => ({ sort }));
  return { find, sort, lean, exec };
}

function findOneLeanChainMock(resolvedValue: unknown) {
  const exec = jest.fn<any>().mockResolvedValue(resolvedValue);
  const lean = jest.fn<any>(() => ({ exec }));
  const findOne = jest.fn<any>(() => ({ lean }));
  return { findOne, lean, exec };
}

function extra(
  id: string,
  date: LocalDate,
  discipline: string,
  duration: number,
  calories?: number | null,
) {
  return {
    _id: id,
    userId: USER_ID,
    workoutSessionId: `ws-${id}`,
    discipline,
    date: localDateToUtc(date, TIMEZONE),
    duration,
    intensityLevel: 3,
    calories: calories ?? null,
  };
}

function weightLog(id: string, date: LocalDate, weightKg: number) {
  return { _id: id, userId: USER_ID, weightKg, loggedAt: localDateToUtc(date, TIMEZONE) };
}

describe('CaloriesCalculator (stats-charts)', () => {
  let extraMock: ReturnType<typeof leanChainMock>;
  let weightMock: ReturnType<typeof sortedChainMock>;
  let profileMock: ReturnType<typeof findOneLeanChainMock>;
  let calculator: CaloriesCalculator;

  beforeEach(() => {
    extraMock = leanChainMock([]);
    weightMock = sortedChainMock([]);
    profileMock = findOneLeanChainMock(null);
    calculator = new CaloriesCalculator(extraMock as any, weightMock as any, profileMock as any);
  });

  it('prefers the manual calories override and counts only estimated sessions', async () => {
    extraMock.exec.mockResolvedValue([
      extra('es1', '2026-09-02', 'running', 30, 500),
      extra('es2', '2026-09-03', 'running', 60, null),
      extra('es3', '2026-09-04', 'cycling', 45, null),
    ]);
    weightMock.exec.mockResolvedValue([weightLog('wl1', '2026-09-01', 80)]);

    const result = await calculator.execute(USER_ID, '2026-09-01', '2026-09-06', TIMEZONE);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      weekKey: '2026-W36',
      routineKcal: null,
      extraKcal: 1590,
      totalKcal: 1590,
      estimatedSessions: 2,
    });
    // 500 manual + 640 (running 8 × 80 × 60/60) + 450 (cycling 7.5 × 80 × 45/60)
    expect(result[0].extraKcal).toBeCloseTo(1590, 5);
  });

  it('uses the latest weight log with loggedAt <= session date', async () => {
    extraMock.exec.mockResolvedValue([
      extra('es1', '2026-09-02', 'walking', 30, null),
      extra('es2', '2026-09-04', 'walking', 30, null),
    ]);
    weightMock.exec.mockResolvedValue([
      weightLog('wl1', '2026-09-01', 80),
      weightLog('wl2', '2026-09-03', 90),
    ]);

    const result = await calculator.execute(USER_ID, '2026-09-01', '2026-09-06', TIMEZONE);

    expect(result[0].extraKcal).toBeCloseTo(140 + 157.5, 5);
  });

  it('falls back to the user profile weight when no weight log exists', async () => {
    extraMock.exec.mockResolvedValue([extra('es1', '2026-09-02', 'yoga', 60, null)]);
    weightMock.exec.mockResolvedValue([]);
    profileMock.exec.mockResolvedValue({ userId: USER_ID, weightKg: 70 });

    const result = await calculator.execute(USER_ID, '2026-09-01', '2026-09-06', TIMEZONE);

    // yoga MET 3 × 70 × 60/60 = 210
    expect(result[0].extraKcal).toBeCloseTo(210, 5);
    expect(result[0].estimatedSessions).toBe(1);
  });

  it('contributes 0 and skips estimation when no weight source exists', async () => {
    extraMock.exec.mockResolvedValue([extra('es1', '2026-09-02', 'running', 60, null)]);
    weightMock.exec.mockResolvedValue([]);
    profileMock.exec.mockResolvedValue(null);

    const result = await calculator.execute(USER_ID, '2026-09-01', '2026-09-06', TIMEZONE);

    expect(result[0]).toMatchObject({ extraKcal: 0, estimatedSessions: 0 });
  });

  it('keeps routineKcal null and emits zeroed entries for data-less weeks', async () => {
    extraMock.exec.mockResolvedValue([extra('es1', '2026-09-02', 'running', 30, null)]);
    weightMock.exec.mockResolvedValue([weightLog('wl1', '2026-09-01', 80)]);

    const result = await calculator.execute(USER_ID, '2026-09-01', '2026-09-13', TIMEZONE);

    expect(result.map((w) => w.weekKey)).toEqual(['2026-W36', '2026-W37']);
    expect(result[0].weekKey).toBe('2026-W36');
    expect(result[1]).toEqual({
      weekKey: '2026-W37',
      routineKcal: null,
      extraKcal: 0,
      totalKcal: 0,
      estimatedSessions: 0,
    });
  });

  it('scopes extras, weight logs and profile to the user and window', async () => {
    extraMock.exec.mockResolvedValue([]);
    weightMock.exec.mockResolvedValue([]);
    profileMock.exec.mockResolvedValue(null);

    await calculator.execute(USER_ID, '2026-09-01', '2026-09-06', TIMEZONE);

    const extraQuery = extraMock.find.mock.calls[0][0];
    expect(extraQuery.userId.toString()).toBe(USER_ID);
    expect(extraQuery.date.$gte.toISOString()).toBe('2026-09-01T03:00:00.000Z');
    expect(extraQuery.date.$lt.toISOString()).toBe('2026-09-07T03:00:00.000Z');

    const weightQuery = weightMock.find.mock.calls[0][0];
    expect(weightQuery.userId.toString()).toBe(USER_ID);
    expect(weightQuery.loggedAt.$lte.toISOString()).toBe('2026-09-07T03:00:00.000Z');

    const profileQuery = profileMock.findOne.mock.calls[0][0];
    expect(profileQuery.userId.toString()).toBe(USER_ID);
  });
});


