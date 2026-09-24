import { Injectable } from '@nestjs/common';
import { LocalDate } from '../../common/utils/date.utils';
import { OneRmWeeklyCalculator } from './calculators/one-rm-weekly.calculator';
import { VolumeWeeklyCalculator } from './calculators/volume-weekly.calculator';
import { VolumeTotalWeeklyCalculator } from './calculators/volume-total.calculator';
import { CaloriesCalculator } from './calculators/calories.calculator';
import { ForgottenMusclesCalculator } from './calculators/forgotten-muscles.calculator';
import { TrendCalculator } from './calculators/trend.calculator';
import { Exercise1RmWeekly } from './presentation/entities/one-rm-weekly.output';
import { VolumeWeeklyEntry } from './presentation/entities/volume-weekly.output';
import { VolumeTotalWeeklyEntry } from './presentation/entities/volume-total-weekly.output';
import { CaloriesWeeklyEntry } from './presentation/entities/calories-weekly.output';
import { ForgottenMuscle } from './presentation/entities/forgotten-muscle.output';
import { ExerciseTrend } from './presentation/entities/exercise-trend.output';

@Injectable()
export class StatsChartsService {
  constructor(
    private readonly oneRmWeeklyCalculator: OneRmWeeklyCalculator,
    private readonly volumeWeeklyCalculator: VolumeWeeklyCalculator,
    private readonly volumeTotalWeeklyCalculator: VolumeTotalWeeklyCalculator,
    private readonly caloriesCalculator: CaloriesCalculator,
    private readonly forgottenMusclesCalculator: ForgottenMusclesCalculator,
    private readonly trendCalculator: TrendCalculator,
  ) {}

  getStats1RmWeekly(
    userId: string,
    from: LocalDate,
    to: LocalDate,
    timezone: string,
  ): Promise<Exercise1RmWeekly[]> {
    return this.oneRmWeeklyCalculator.execute(userId, from, to, timezone);
  }

  getStatsVolumeWeekly(
    userId: string,
    from: LocalDate,
    to: LocalDate,
    timezone: string,
  ): Promise<VolumeWeeklyEntry[]> {
    return this.volumeWeeklyCalculator.execute(userId, from, to, timezone);
  }

  getStatsVolumeTotalWeekly(
    userId: string,
    from: LocalDate,
    to: LocalDate,
    timezone: string,
  ): Promise<VolumeTotalWeeklyEntry[]> {
    return this.volumeTotalWeeklyCalculator.execute(userId, from, to, timezone);
  }

  getStatsCaloriesWeekly(
    userId: string,
    from: LocalDate,
    to: LocalDate,
    timezone: string,
  ): Promise<CaloriesWeeklyEntry[]> {
    return this.caloriesCalculator.execute(userId, from, to, timezone);
  }

  getStatsForgottenMuscles(
    userId: string,
    from: LocalDate,
    to: LocalDate,
    timezone: string,
  ): Promise<ForgottenMuscle[]> {
    return this.forgottenMusclesCalculator.execute(userId, from, to, timezone);
  }

  getStatsExerciseTrend(
    userId: string,
    from: LocalDate,
    to: LocalDate,
    timezone: string,
  ): Promise<ExerciseTrend[]> {
    return this.trendCalculator.execute(userId, from, to, timezone);
  }
}