import { SaveTopExercisesUseCase } from './save-top-exercises.use-case';
import { SaveTopRoutinesUseCase } from './save-top-routines.use-case';
import { SavePersonalRecordsUseCase } from './save-personal-records.use-case';
import { SaveAdherenceUseCase } from './save-adherence.use-case';
import { GetTopExercisesUseCase } from './get-top-exercises.use-case';
import { GetTopRoutinesUseCase } from './get-top-routines.use-case';
import { GetPersonalRecordsUseCase } from './get-personal-records.use-case';
import { GetAdherenceUseCase } from './get-adherence.use-case';
import { GetRawDataForWorkerUseCase } from './get-raw-data-for-worker.use-case';

export const STAT_USE_CASES = [
  SaveTopExercisesUseCase,
  SaveTopRoutinesUseCase,
  SavePersonalRecordsUseCase,
  SaveAdherenceUseCase,
  GetTopExercisesUseCase,
  GetTopRoutinesUseCase,
  GetPersonalRecordsUseCase,
  GetAdherenceUseCase,
  GetRawDataForWorkerUseCase,
];

export * from './save-top-exercises.use-case';
export * from './save-top-routines.use-case';
export * from './save-personal-records.use-case';
export * from './save-adherence.use-case';
export * from './get-top-exercises.use-case';
export * from './get-top-routines.use-case';
export * from './get-personal-records.use-case';
export * from './get-adherence.use-case';
export * from './get-raw-data-for-worker.use-case';
