import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  UserTopExercise,
  UserTopExerciseDocument,
} from '../schemas/user-top-exercise.schema';
import {
  UserTopRoutine,
  UserTopRoutineDocument,
} from '../schemas/user-top-routine.schema';
import {
  UserPersonalRecord,
  UserPersonalRecordDocument,
} from '../schemas/user-personal-record.schema';
import {
  UserAdherence,
  UserAdherenceDocument,
} from '../schemas/user-adherence.schema';
import { IStatsRepository } from '../../domain/interfaces/repositories/stats.repository.interface';
import {
  UserTopExerciseDomain,
  TopExerciseEntryDomain,
  UserTopRoutineDomain,
  TopRoutineEntryDomain,
  UserPersonalRecordDomain,
  PersonalRecordEntryDomain,
  UserAdherenceDomain,
  AdherenceWeekDomain,
} from '../../domain/entities/stats.domain';

@Injectable()
export class StatsRepository implements IStatsRepository {
  constructor(
    @InjectModel(UserTopExercise.name)
    private readonly topExerciseModel: Model<UserTopExerciseDocument>,
    @InjectModel(UserTopRoutine.name)
    private readonly topRoutineModel: Model<UserTopRoutineDocument>,
    @InjectModel(UserPersonalRecord.name)
    private readonly personalRecordModel: Model<UserPersonalRecordDocument>,
    @InjectModel(UserAdherence.name)
    private readonly adherenceModel: Model<UserAdherenceDocument>,
  ) {}

  async findTopExercisesByUser(userId: string): Promise<UserTopExerciseDomain | null> {
    const doc = await this.topExerciseModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
    if (!doc) return null;
    return this.mapTopExerciseToDomain(doc);
  }

  async findTopRoutinesByUser(userId: string): Promise<UserTopRoutineDomain | null> {
    const doc = await this.topRoutineModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
    if (!doc) return null;
    return this.mapTopRoutineToDomain(doc);
  }

  async findPersonalRecordsByUser(userId: string): Promise<UserPersonalRecordDomain | null> {
    const doc = await this.personalRecordModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
    if (!doc) return null;
    return this.mapPersonalRecordToDomain(doc);
  }

  async findAdherenceByUser(userId: string): Promise<UserAdherenceDomain | null> {
    const doc = await this.adherenceModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
    if (!doc) return null;
    return this.mapAdherenceToDomain(doc);
  }

  async upsertTopExercises(
    userId: string,
    data: UserTopExerciseDomain,
  ): Promise<UserTopExerciseDomain> {
    const doc = await this.topExerciseModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      {
        userId: new Types.ObjectId(userId),
        computedAt: data.computedAt,
        exercises: data.exercises.map((e) => ({
          rank: e.rank,
          exerciseId: new Types.ObjectId(e.exerciseId),
          name: e.name,
          category: e.category,
          totalSessions: e.totalSessions,
          totalVolume: e.totalVolume,
          avgVolumePerSession: e.avgVolumePerSession,
        })),
      },
      { upsert: true, new: true, runValidators: true },
    );
    return this.mapTopExerciseToDomain(doc);
  }

  async upsertTopRoutines(
    userId: string,
    data: UserTopRoutineDomain,
  ): Promise<UserTopRoutineDomain> {
    const doc = await this.topRoutineModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      {
        userId: new Types.ObjectId(userId),
        computedAt: data.computedAt,
        routines: data.routines.map((r) => ({
          rank: r.rank,
          planId: new Types.ObjectId(r.planId),
          name: r.name,
          totalWeeks: r.totalWeeks,
          totalSessions: r.totalSessions,
          adherenceRate: r.adherenceRate,
        })),
      },
      { upsert: true, new: true, runValidators: true },
    );
    return this.mapTopRoutineToDomain(doc);
  }

  async upsertPersonalRecords(
    userId: string,
    data: UserPersonalRecordDomain,
  ): Promise<UserPersonalRecordDomain> {
    const doc = await this.personalRecordModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      {
        userId: new Types.ObjectId(userId),
        computedAt: data.computedAt,
        records: data.records.map((r) => ({
          exerciseId: new Types.ObjectId(r.exerciseId),
          exerciseName: r.exerciseName,
          category: r.category,
          oneRmEstimated: r.oneRmEstimated,
          bestWeight: r.bestWeight,
          bestReps: r.bestReps,
          bestVolume: r.bestVolume,
          achievedAt: r.achievedAt,
          previousOneRm: r.previousOneRm,
        })),
      },
      { upsert: true, new: true, runValidators: true },
    );
    return this.mapPersonalRecordToDomain(doc);
  }

  async upsertAdherence(
    userId: string,
    data: UserAdherenceDomain,
  ): Promise<UserAdherenceDomain> {
    const doc = await this.adherenceModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      {
        userId: new Types.ObjectId(userId),
        computedAt: data.computedAt,
        weeks: data.weeks.map((w) => ({
          weekStartDate: w.weekStartDate,
          totalDays: w.totalDays,
          completedDays: w.completedDays,
          skippedDays: w.skippedDays,
          pendingDays: w.pendingDays,
          adherencePercent: w.adherencePercent,
        })),
      },
      { upsert: true, new: true, runValidators: true },
    );
    return this.mapAdherenceToDomain(doc);
  }

  private mapTopExerciseToDomain(doc: UserTopExerciseDocument): UserTopExerciseDomain {
    return new UserTopExerciseDomain(
      doc._id.toString(),
      doc.userId.toString(),
      doc.computedAt,
      doc.exercises.map(
        (e) =>
          new TopExerciseEntryDomain(
            e.rank,
            e.exerciseId.toString(),
            e.name,
            e.category,
            e.totalSessions,
            e.totalVolume,
            e.avgVolumePerSession,
          ),
      ),
    );
  }

  private mapTopRoutineToDomain(doc: UserTopRoutineDocument): UserTopRoutineDomain {
    return new UserTopRoutineDomain(
      doc._id.toString(),
      doc.userId.toString(),
      doc.computedAt,
      doc.routines.map(
        (r) =>
          new TopRoutineEntryDomain(
            r.rank,
            r.planId.toString(),
            r.name,
            r.totalWeeks,
            r.totalSessions,
            r.adherenceRate,
          ),
      ),
    );
  }

  private mapPersonalRecordToDomain(doc: UserPersonalRecordDocument): UserPersonalRecordDomain {
    return new UserPersonalRecordDomain(
      doc._id.toString(),
      doc.userId.toString(),
      doc.computedAt,
      doc.records.map(
        (r) =>
          new PersonalRecordEntryDomain(
            r.exerciseId.toString(),
            r.exerciseName,
            r.category,
            r.oneRmEstimated,
            r.bestWeight,
            r.bestReps,
            r.bestVolume,
            r.achievedAt,
            r.previousOneRm,
          ),
      ),
    );
  }

  private mapAdherenceToDomain(doc: UserAdherenceDocument): UserAdherenceDomain {
    return new UserAdherenceDomain(
      doc._id.toString(),
      doc.userId.toString(),
      doc.computedAt,
      doc.weeks.map(
        (w) =>
          new AdherenceWeekDomain(
            w.weekStartDate,
            w.totalDays,
            w.completedDays,
            w.skippedDays,
            w.pendingDays,
            w.adherencePercent,
          ),
      ),
    );
  }
}
