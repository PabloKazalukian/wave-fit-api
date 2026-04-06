import { CreateWeekLogUseCase } from './create-week-log.use-case';
import { FindAllWeekLogsByUserUseCase } from './find-all-week-logs-by-user.use-case';
import { FindOneWeekLogUseCase } from './find-one-week-log.use-case';

export const WEEK_LOG_USE_CASES = [
  CreateWeekLogUseCase,
  FindAllWeekLogsByUserUseCase,
  FindOneWeekLogUseCase,
];

export * from './create-week-log.use-case';
export * from './find-all-week-logs-by-user.use-case';
