import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, UpdateQuery } from 'mongoose';
import { DayLog, DayLogDocument } from '../schemas/day-log.schema';
import { IDayLogRepository } from '../../domain/interfaces/repositories/day-log.repository.interface';
import { DayLogDomain } from '../../domain/entities/day-log.domain';
import { nowUtc } from 'src/common/utils/date.utils';
import { DayLog as DayLogEntity } from '../../presentation/entities/day-log.entity';

@Injectable()
export class DayLogRepository implements IDayLogRepository {
  constructor(
    @InjectModel(DayLog.name)
    private readonly dayLogModel: Model<DayLog>,
  ) {}

  async findOne(id: string, userId: string): Promise<DayLogDomain | null> {
    const doc = await this.dayLogModel
      .findOne({
        _id: new Types.ObjectId(id),
        userId: new Types.ObjectId(userId),
        deleted: { $ne: true },
      })
      .populate('workoutSessionId')
      .exec();

    if (!doc) return null;
    return this.mapToDomain(doc);
  }

  async findAllByUser(
    userId: string,
    limit?: number,
    offset?: number,
  ): Promise<DayLogDomain[]> {
    const query = this.dayLogModel
      .find({
        userId: new Types.ObjectId(userId),
        deleted: { $ne: true },
      })
      .sort({ date: -1 })
      .populate('workoutSessionId');

    if (offset !== undefined) {
      query.skip(offset);
    }

    if (limit !== undefined) {
      query.limit(limit);
    }

    const docs = await query.exec();
    return docs.map((doc) => this.mapToDomain(doc));
  }

  async findActive(userId: string): Promise<DayLogDomain | null> {
    const doc = await this.dayLogModel
      .findOne({
        userId: new Types.ObjectId(userId),
        active: true,
        deleted: { $ne: true },
      })
      .populate('workoutSessionId')
      .populate('extraSessionIds')
      .exec();

    if (!doc) return null;
    return this.mapToDomain(doc);
  }

  async create(data: DayLogDomain): Promise<DayLogDomain> {
    const plainData = {
      userId: new Types.ObjectId(data.userId),
      date: data.date,
      planId: data.planId ? new Types.ObjectId(data.planId) : null,
      routineDayId: data.routineDayId
        ? new Types.ObjectId(data.routineDayId)
        : null,
      workoutSessionId: data.workoutSessionId
        ? new Types.ObjectId(data.workoutSessionId)
        : null,
      extraSessionIds: (data.extraSessionIds ?? []).map((id: any) =>
        typeof id === 'string' ? new Types.ObjectId(id) : id,
      ),
      status: data.status,
      active: data.active,
      completed: data.completed,
      notes: data.notes,
    };

    const dayLog = new this.dayLogModel(plainData);
    await dayLog.save();

    const populated = await this.dayLogModel
      .findById(dayLog._id)
      .populate('workoutSessionId')
      .exec();

    return this.mapToDomain(populated!);
  }

  async findByIdAndUpdate(
    id: string,
    update: UpdateQuery<DayLogEntity>,
    options?: { new?: boolean; runValidators?: boolean },
  ): Promise<DayLogDomain> {
    const doc = await this.dayLogModel
      .findByIdAndUpdate(id, update, {
        new: options?.new ?? true,
        runValidators: options?.runValidators ?? true,
      })
      .populate('workoutSessionId')
      .exec();

    if (!doc) {
      throw new NotFoundException(`DayLog con ID "${id}" no encontrado`);
    }

    return this.mapToDomain(doc);
  }

  async findByIdAndSoftDelete(
    id: string,
    userId: string,
  ): Promise<DayLogDomain | null> {
    const doc = await this.dayLogModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(id),
          userId: new Types.ObjectId(userId),
          deleted: { $ne: true },
        },
        {
          deleted: true,
          deletedAt: nowUtc(),
        },
        { new: true },
      )
      .populate('workoutSessionId')
      .exec();

    if (!doc) return null;

    return this.mapToDomain(doc);
  }

  async delete(id: string): Promise<void> {
    await this.dayLogModel.deleteOne({ _id: id }).exec();
  }

  async findRaw(id: string): Promise<any> {
    return this.dayLogModel.findById(id).exec();
  }

  async findActiveRaw(userId: string): Promise<any> {
    return this.dayLogModel
      .findOne({
        userId: new Types.ObjectId(userId),
        active: true,
        deleted: { $ne: true },
      })
      .exec();
  }

  async updateStatus(
    id: string,
    status: string,
    workoutSessionId: string | null,
  ): Promise<void> {
    await this.dayLogModel.updateOne(
      { _id: new Types.ObjectId(id) },
      {
        $set: {
          status,
          workoutSessionId: workoutSessionId
            ? new Types.ObjectId(workoutSessionId)
            : null,
        },
      },
    );
  }

  private mapToDomain(doc: DayLogDocument): DayLogDomain {
    const obj = doc.toObject();

    const session = obj.workoutSessionId;
    const isPopulated = session && typeof session === 'object' && session._id;

    return new DayLogDomain(
      obj._id.toString(),
      obj.userId.toString(),
      obj.date,
      obj.planId ? obj.planId.toString() : null,
      obj.routineDayId ? obj.routineDayId.toString() : null,
      isPopulated
        ? session._id.toString()
        : session
          ? session.toString()
          : null,
      (obj.extraSessionIds ?? []).map((id: any) => {
        if (id && typeof id === 'object' && id._id) {
          return id._id.toString();
        }
        return id.toString();
      }),
      obj.status as DayLogDomain['status'],
      obj.active,
      obj.completed,
      obj.notes,
      isPopulated ? ((session as any).exercises ?? []) : [],
    );
  }
}
