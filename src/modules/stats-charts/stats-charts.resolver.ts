import { Resolver, Query, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { extractUserId } from 'src/common/utils/user-id.utils';
import { StatsChartsService } from './stats-charts.service';
import { StatsChartsInput } from './presentation/dto/stats-charts.input';
import { validateStatsChartsRange } from './common/range.utils';
import { Exercise1RmWeekly } from './presentation/entities/one-rm-weekly.output';
import { VolumeWeeklyEntry } from './presentation/entities/volume-weekly.output';
import { VolumeTotalWeeklyEntry } from './presentation/entities/volume-total-weekly.output';
import { CaloriesWeeklyEntry } from './presentation/entities/calories-weekly.output';
import { ForgottenMuscle } from './presentation/entities/forgotten-muscle.output';
import { ExerciseTrend } from './presentation/entities/exercise-trend.output';

@Resolver()
@UseGuards(GqlAuthGuard)
export class StatsChartsResolver {
  constructor(private readonly statsChartsService: StatsChartsService) {}

  @Query(() => [Exercise1RmWeekly], { name: 'getStats1RmWeekly' })
  async getStats1RmWeekly(
    @Args('input') input: StatsChartsInput,
    @Context() context: any,
  ): Promise<Exercise1RmWeekly[]> {
    const userId = extractUserId(context);
    const { timezone } = validateStatsChartsRange(input.from, input.to, input.timezone);
    return this.statsChartsService.getStats1RmWeekly(
      userId,
      input.from,
      input.to,
      timezone,
    );
  }

  @Query(() => [VolumeWeeklyEntry], { name: 'getStatsVolumeWeekly' })
  async getStatsVolumeWeekly(
    @Args('input') input: StatsChartsInput,
    @Context() context: any,
  ): Promise<VolumeWeeklyEntry[]> {
    const userId = extractUserId(context);
    const { timezone } = validateStatsChartsRange(input.from, input.to, input.timezone);
    return this.statsChartsService.getStatsVolumeWeekly(
      userId,
      input.from,
      input.to,
      timezone,
    );
  }

  @Query(() => [VolumeTotalWeeklyEntry], { name: 'getStatsVolumeTotalWeekly' })
  async getStatsVolumeTotalWeekly(
    @Args('input') input: StatsChartsInput,
    @Context() context: any,
  ): Promise<VolumeTotalWeeklyEntry[]> {
    const userId = extractUserId(context);
    const { timezone } = validateStatsChartsRange(input.from, input.to, input.timezone);
    return this.statsChartsService.getStatsVolumeTotalWeekly(
      userId,
      input.from,
      input.to,
      timezone,
    );
  }

  @Query(() => [CaloriesWeeklyEntry], { name: 'getStatsCaloriesWeekly' })
  async getStatsCaloriesWeekly(
    @Args('input') input: StatsChartsInput,
    @Context() context: any,
  ): Promise<CaloriesWeeklyEntry[]> {
    const userId = extractUserId(context);
    const { timezone } = validateStatsChartsRange(input.from, input.to, input.timezone);
    return this.statsChartsService.getStatsCaloriesWeekly(
      userId,
      input.from,
      input.to,
      timezone,
    );
  }

  @Query(() => [ForgottenMuscle], { name: 'getStatsForgottenMuscles' })
  async getStatsForgottenMuscles(
    @Args('input') input: StatsChartsInput,
    @Context() context: any,
  ): Promise<ForgottenMuscle[]> {
    const userId = extractUserId(context);
    const { timezone } = validateStatsChartsRange(input.from, input.to, input.timezone);
    return this.statsChartsService.getStatsForgottenMuscles(
      userId,
      input.from,
      input.to,
      timezone,
    );
  }

  @Query(() => [ExerciseTrend], { name: 'getStatsExerciseTrend' })
  async getStatsExerciseTrend(
    @Args('input') input: StatsChartsInput,
    @Context() context: any,
  ): Promise<ExerciseTrend[]> {
    const userId = extractUserId(context);
    const { timezone } = validateStatsChartsRange(input.from, input.to, input.timezone);
    return this.statsChartsService.getStatsExerciseTrend(
      userId,
      input.from,
      input.to,
      timezone,
    );
  }
}