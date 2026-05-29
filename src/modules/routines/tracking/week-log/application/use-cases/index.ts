import { CreateWeekLogUseCase } from './create-week-log.use-case';
import { FindAllWeekLogsByUserUseCase } from './find-all-week-logs-by-user.use-case';
import { FindOneWeekLogUseCase } from './find-one-week-log.use-case';
import { FindActiveWeekLogUseCase } from './find-active-week-log.use-case';
import { UpdateDayUseCase } from './update-day.use-case';
import { UpdateWeekLogUseCase } from './update-week-log.use-case';
import { UpdateDayWorkoutStatusUseCase } from './update-day-workout-status.use-case';
import { RemoveWorkoutSessionUseCase } from './remove-workout-session.use-case';
import { RemoveWeekLogUseCase } from './remove-week-log.use-case';
import { RemoveExtraSessionUseCase } from './remove-extra-session.use-case';

export const WEEK_LOG_USE_CASES = [
  CreateWeekLogUseCase,
  FindAllWeekLogsByUserUseCase,
  FindOneWeekLogUseCase,
  FindActiveWeekLogUseCase,
  UpdateDayUseCase,
  UpdateWeekLogUseCase,
  UpdateDayWorkoutStatusUseCase,
  RemoveWeekLogUseCase,
  RemoveWorkoutSessionUseCase,
  RemoveExtraSessionUseCase,
];

export * from './create-week-log.use-case';
export * from './find-all-week-logs-by-user.use-case';
export * from './find-one-week-log.use-case';
export * from './find-active-week-log.use-case';
export * from './update-day.use-case';
export * from './update-week-log.use-case';
export * from './update-day-workout-status.use-case';
export * from './remove-week-log.use-case';
export * from './remove-workout-session.use-case';
export * from './remove-extra-session.use-case';
