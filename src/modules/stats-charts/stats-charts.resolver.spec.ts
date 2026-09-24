import { BadRequestException } from '@nestjs/common';
import { StatsChartsResolver } from './stats-charts.resolver';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { StatsChartsInput } from './presentation/dto/stats-charts.input';
import { STATS_CHARTS_DEFAULT_TIMEZONE } from './stats-charts.config';

const USER_ID = '507f1f77bcf86cd799439011';
const CONTEXT = { req: { user: { userId: USER_ID } } };

function makeInput(
  from: string,
  to: string,
  timezone?: string,
): StatsChartsInput {
  const input = new StatsChartsInput();
  input.from = from;
  input.to = to;
  input.timezone = timezone;
  return input;
}

describe('StatsChartsResolver (stats-charts)', () => {
  let serviceMock: {
    getStats1RmWeekly: jest.Mock;
    getStatsVolumeWeekly: jest.Mock;
    getStatsVolumeTotalWeekly: jest.Mock;
    getStatsCaloriesWeekly: jest.Mock;
    getStatsForgottenMuscles: jest.Mock;
    getStatsExerciseTrend: jest.Mock;
  };
  let resolver: StatsChartsResolver;

  beforeEach(() => {
    serviceMock = {
      getStats1RmWeekly: jest.fn().mockResolvedValue([]),
      getStatsVolumeWeekly: jest.fn().mockResolvedValue([]),
      getStatsVolumeTotalWeekly: jest.fn().mockResolvedValue([]),
      getStatsCaloriesWeekly: jest.fn().mockResolvedValue([]),
      getStatsForgottenMuscles: jest.fn().mockResolvedValue([]),
      getStatsExerciseTrend: jest.fn().mockResolvedValue([]),
    };
    resolver = new StatsChartsResolver(serviceMock as any);
  });

  it('guards the resolver class with GqlAuthGuard', () => {
    const guards = Reflect.getMetadata('__guards__', StatsChartsResolver);
    expect(guards).toContain(GqlAuthGuard);
  });

  it.each([
    ['getStats1RmWeekly', 'getStats1RmWeekly'],
    ['getStatsVolumeWeekly', 'getStatsVolumeWeekly'],
    ['getStatsVolumeTotalWeekly', 'getStatsVolumeTotalWeekly'],
    ['getStatsCaloriesWeekly', 'getStatsCaloriesWeekly'],
    ['getStatsForgottenMuscles', 'getStatsForgottenMuscles'],
    ['getStatsExerciseTrend', 'getStatsExerciseTrend'],
  ])('exposes %s as a GraphQL query', (method, queryName) => {
    expect(
      Reflect.getMetadata('graphql:resolver_type', StatsChartsResolver.prototype[method]),
    ).toBe('Query');
    expect(
      Reflect.getMetadata('graphql:resolver_name', StatsChartsResolver.prototype[method]),
    ).toBe(queryName);
  });

  it('delegates getStats1RmWeekly with userId and a resolved timezone', async () => {
    await resolver.getStats1RmWeekly(
      makeInput('2026-09-01', '2026-09-06', 'America/New_York'),
      CONTEXT,
    );
    expect(serviceMock.getStats1RmWeekly).toHaveBeenCalledWith(
      USER_ID,
      '2026-09-01',
      '2026-09-06',
      'America/New_York',
    );
  });

  it('delegates getStatsVolumeWeekly', async () => {
    await resolver.getStatsVolumeWeekly(
      makeInput('2026-09-01', '2026-09-06'),
      CONTEXT,
    );
    expect(serviceMock.getStatsVolumeWeekly).toHaveBeenCalledWith(
      USER_ID,
      '2026-09-01',
      '2026-09-06',
      STATS_CHARTS_DEFAULT_TIMEZONE,
    );
  });

  it('delegates getStatsVolumeTotalWeekly', async () => {
    await resolver.getStatsVolumeTotalWeekly(
      makeInput('2026-09-01', '2026-09-06'),
      CONTEXT,
    );
    expect(serviceMock.getStatsVolumeTotalWeekly).toHaveBeenCalledWith(
      USER_ID,
      '2026-09-01',
      '2026-09-06',
      STATS_CHARTS_DEFAULT_TIMEZONE,
    );
  });

  it('delegates getStatsCaloriesWeekly', async () => {
    await resolver.getStatsCaloriesWeekly(
      makeInput('2026-09-01', '2026-09-06'),
      CONTEXT,
    );
    expect(serviceMock.getStatsCaloriesWeekly).toHaveBeenCalledWith(
      USER_ID,
      '2026-09-01',
      '2026-09-06',
      STATS_CHARTS_DEFAULT_TIMEZONE,
    );
  });

  it('delegates getStatsForgottenMuscles', async () => {
    await resolver.getStatsForgottenMuscles(
      makeInput('2026-09-01', '2026-09-06'),
      CONTEXT,
    );
    expect(serviceMock.getStatsForgottenMuscles).toHaveBeenCalledWith(
      USER_ID,
      '2026-09-01',
      '2026-09-06',
      STATS_CHARTS_DEFAULT_TIMEZONE,
    );
  });

  it('delegates getStatsExerciseTrend', async () => {
    await resolver.getStatsExerciseTrend(
      makeInput('2026-09-01', '2026-09-06'),
      CONTEXT,
    );
    expect(serviceMock.getStatsExerciseTrend).toHaveBeenCalledWith(
      USER_ID,
      '2026-09-01',
      '2026-09-06',
      STATS_CHARTS_DEFAULT_TIMEZONE,
    );
  });

  it.each([
    ['getStats1RmWeekly' as const],
    ['getStatsVolumeWeekly' as const],
    ['getStatsVolumeTotalWeekly' as const],
    ['getStatsCaloriesWeekly' as const],
    ['getStatsForgottenMuscles' as const],
    ['getStatsExerciseTrend' as const],
  ])('rejects an inverted window for %s', async (method) => {
    await expect(
      resolver[method](makeInput('2026-09-06', '2026-09-01'), CONTEXT),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a window longer than 120 days', async () => {
    await expect(
      resolver.getStatsVolumeTotalWeekly(
        makeInput('2026-01-01', '2026-05-10'),
        CONTEXT,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});