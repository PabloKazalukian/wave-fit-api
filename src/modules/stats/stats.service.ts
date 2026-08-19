import { Injectable } from '@nestjs/common';
import {
  GetTopExercisesUseCase,
  GetTopRoutinesUseCase,
  GetPersonalRecordsUseCase,
  GetAdherenceUseCase,
  GetRawDataForWorkerUseCase,
  SaveTopExercisesUseCase,
  SaveTopRoutinesUseCase,
  SavePersonalRecordsUseCase,
  SaveAdherenceUseCase,
} from './application/use-cases';
import {
  UserTopExerciseDomain,
  UserTopRoutineDomain,
  UserPersonalRecordDomain,
  UserAdherenceDomain,
  WorkerRawDataDomain,
} from './domain/entities/stats.domain';

@Injectable()
export class StatsService {
  constructor(
    private readonly getTopExercisesUseCase: GetTopExercisesUseCase,
    private readonly getTopRoutinesUseCase: GetTopRoutinesUseCase,
    private readonly getPersonalRecordsUseCase: GetPersonalRecordsUseCase,
    private readonly getAdherenceUseCase: GetAdherenceUseCase,
    private readonly getRawDataForWorkerUseCase: GetRawDataForWorkerUseCase,
    private readonly saveTopExercisesUseCase: SaveTopExercisesUseCase,
    private readonly saveTopRoutinesUseCase: SaveTopRoutinesUseCase,
    private readonly savePersonalRecordsUseCase: SavePersonalRecordsUseCase,
    private readonly saveAdherenceUseCase: SaveAdherenceUseCase,
  ) {}

  async getTopExercises(userId: string): Promise<UserTopExerciseDomain | null> {
    return this.getTopExercisesUseCase.execute(userId);
  }

  async getTopRoutines(userId: string): Promise<UserTopRoutineDomain | null> {
    return this.getTopRoutinesUseCase.execute(userId);
  }

  async getPersonalRecords(userId: string): Promise<UserPersonalRecordDomain | null> {
    return this.getPersonalRecordsUseCase.execute(userId);
  }

  async getAdherence(userId: string): Promise<UserAdherenceDomain | null> {
    return this.getAdherenceUseCase.execute(userId);
  }

  async getRawDataForWorker(userId: string): Promise<WorkerRawDataDomain> {
    return this.getRawDataForWorkerUseCase.execute(userId);
  }

  async saveTopExercises(
    userId: string,
    exercises: {
      rank: number;
      exerciseId: string;
      name: string;
      category: string;
      totalSessions: number;
      totalVolume: number;
      avgVolumePerSession: number;
    }[],
    computedAt: Date,
  ): Promise<UserTopExerciseDomain> {
    return this.saveTopExercisesUseCase.execute(userId, exercises, computedAt);
  }

  async saveTopRoutines(
    userId: string,
    routines: {
      rank: number;
      planId: string;
      name: string;
      totalWeeks: number;
      totalSessions: number;
      adherenceRate: number;
    }[],
    computedAt: Date,
  ): Promise<UserTopRoutineDomain> {
    return this.saveTopRoutinesUseCase.execute(userId, routines, computedAt);
  }

  async savePersonalRecords(
    userId: string,
    records: {
      exerciseId: string;
      exerciseName: string;
      category: string;
      oneRmEstimated: number;
      bestWeight: number;
      bestReps: number;
      bestVolume: number;
      achievedAt: Date;
      previousOneRm: number | null;
    }[],
    computedAt: Date,
  ): Promise<UserPersonalRecordDomain> {
    return this.savePersonalRecordsUseCase.execute(userId, records, computedAt);
  }

  async saveAdherence(
    userId: string,
    weeks: {
      weekStartDate: Date;
      totalDays: number;
      completedDays: number;
      skippedDays: number;
      pendingDays: number;
      adherencePercent: number;
    }[],
    computedAt: Date,
  ): Promise<UserAdherenceDomain> {
    return this.saveAdherenceUseCase.execute(userId, weeks, computedAt);
  }
}
