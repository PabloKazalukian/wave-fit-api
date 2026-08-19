import {
  UserTopExerciseDomain,
  UserTopRoutineDomain,
  UserPersonalRecordDomain,
  UserAdherenceDomain,
} from '../../entities/stats.domain';

export const STATS_REPOSITORY = 'STATS_REPOSITORY';

export interface IStatsRepository {
  findTopExercisesByUser(userId: string): Promise<UserTopExerciseDomain | null>;
  findTopRoutinesByUser(userId: string): Promise<UserTopRoutineDomain | null>;
  findPersonalRecordsByUser(userId: string): Promise<UserPersonalRecordDomain | null>;
  findAdherenceByUser(userId: string): Promise<UserAdherenceDomain | null>;

  upsertTopExercises(userId: string, data: UserTopExerciseDomain): Promise<UserTopExerciseDomain>;
  upsertTopRoutines(userId: string, data: UserTopRoutineDomain): Promise<UserTopRoutineDomain>;
  upsertPersonalRecords(userId: string, data: UserPersonalRecordDomain): Promise<UserPersonalRecordDomain>;
  upsertAdherence(userId: string, data: UserAdherenceDomain): Promise<UserAdherenceDomain>;
}
