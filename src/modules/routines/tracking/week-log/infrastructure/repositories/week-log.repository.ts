import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, UpdateQuery } from 'mongoose';
import { WeekLog, WeekLogDocument } from '../schemas/week-log.schema';
import { IWeekLogRepository } from '../../domain/interfaces/repositories/week-log.repository.interface';
import {
  WeekLogDayDomain,
  WeekLogDomain,
} from '../../domain/entities/week-log.domain';
import { nowUtc } from 'src/common/utils/date.utils';

@Injectable()
export class WeekLogRepository implements IWeekLogRepository {
  constructor(
    @InjectModel(WeekLog.name)
    private readonly weekLogModel: Model<WeekLog>,
  ) {}

  // ─── Queries ────────────────────────────────────────────────────────────────

  async findOne(id: string, userId: string): Promise<WeekLogDomain | null> {
    const doc = await this.weekLogModel
      .findOne({
        _id: id,
        userId: userId,
        deleted: { $ne: true },
      })
      .populate('days.workoutSessionId')
      .exec();

    if (!doc) return null;
    return this.mapToDomain(doc);
  }

  async findAllByUser(
    userId: string,
    limit?: number,
    offset?: number,
  ): Promise<WeekLogDomain[]> {
    // console.log('[userID]', userId);
    const query = this.weekLogModel
      .find({
        userId: userId,
        active: false,
        deleted: { $ne: true },
      })
      .sort({ endDate: -1 })
      .populate('days.workoutSessionId');

    if (offset !== undefined) {
      query.skip(offset);
    }

    if (limit !== undefined) {
      query.limit(limit);
    }

    const docs = await query.exec();
    return docs.map((doc) => this.mapToDomain(doc));
  }

  async findActive(userId: string): Promise<WeekLogDomain | null> {
    const doc = await this.weekLogModel
      .findOne({
        userId: new Types.ObjectId(userId),
        active: true,
        deleted: { $ne: true },
      })
      .populate('days.workoutSessionId')
      .populate('days.extraSessionIds')
      .exec();

    if (!doc) return null;
    return this.mapToDomain(doc);
  }

  async findPlanById(planId: string): Promise<any> {
    return this.weekLogModel.findById(planId).exec();
  }

  // ─── Commands ────────────────────────────────────────────────────────────────

  async create(data: WeekLogDomain): Promise<WeekLogDomain> {
    const plainDays = data.days.map((d) => ({
      order: d.order,
      date: d.date,
      isRest: d.isRest,
      workoutSessionId: d.workoutSessionId
        ? new Types.ObjectId(d.workoutSessionId)
        : null,
      extraSessionIds: (d.extraSessionIds ?? []).map((id: any) =>
        typeof id === 'string' ? new Types.ObjectId(id) : id,
      ),
      status: d.status,
    }));

    const plainData = {
      userId: new Types.ObjectId(data.userId),
      startDate: data.startDate,
      endDate: data.endDate,
      planId: data.planId ? new Types.ObjectId(data.planId) : null,
      days: plainDays,
      completed: data.completed,
      active: data.active,
      notes: data.notes,
    };

    const weekLog = new this.weekLogModel(plainData);
    await weekLog.save();

    const populated = await this.weekLogModel
      .findById(weekLog._id)
      .populate('days.workoutSessionId')
      .exec();

    return this.mapToDomain(populated!);
  }

  async createWithPlanId(data: WeekLogDomain): Promise<any> {
    const plainDays = data.days.map((d) => ({
      order: d.order,
      date: d.date,
      isRest: d.isRest,
      workoutSessionId: d.workoutSessionId
        ? new Types.ObjectId(d.workoutSessionId)
        : null,
      extraSessionIds: (d.extraSessionIds ?? []).map((id: any) =>
        typeof id === 'string' ? new Types.ObjectId(id) : id,
      ),
      status: d.status,
    }));

    const weekLog = new this.weekLogModel({
      userId: new Types.ObjectId(data.userId),
      startDate: data.startDate,
      endDate: data.endDate,
      planId: data.planId ? new Types.ObjectId(data.planId) : null,
      days: plainDays,
      completed: false,
      active: true,
    });
    await weekLog.save();
    return weekLog;
  }

  async findByIdAndUpdate(
    id: string,
    update: UpdateQuery<WeekLog>,
    options?: { new?: boolean; runValidators?: boolean },
  ): Promise<WeekLogDomain> {
    const doc = await this.weekLogModel
      .findByIdAndUpdate(id, update, {
        new: options?.new ?? true,
        runValidators: options?.runValidators ?? true,
      })
      .populate('days.workoutSessionId')
      .exec();

    if (!doc) {
      throw new NotFoundException(`WeekLog con ID "${id}" no encontrado`);
    }

    return this.mapToDomain(doc);
  }

  async findByIdAndSoftDelete(id: string): Promise<WeekLogDomain> {
    const doc = await this.weekLogModel
      .findByIdAndUpdate(
        id,
        {
          deleted: true,
          deletedAt: nowUtc(),
        },
        { new: true },
      )
      .populate('days.workoutSessionId')
      .exec();

    if (!doc)
      throw new NotFoundException(`WeekLog con ID "${id}" no encontrado`);

    return this.mapToDomain(doc);
  }

  async delete(id: string): Promise<void> {
    await this.weekLogModel.deleteOne({ _id: id }).exec();
  }

  async updateDayField(
    weekLogId: string,
    order: number,
    fields: Partial<WeekLogDayDomain>,
  ): Promise<void> {
    const setPayload: Record<string, any> = {};

    if (fields.workoutSessionId !== undefined) {
      setPayload['days.$.workoutSessionId'] = fields.workoutSessionId
        ? new Types.ObjectId(fields.workoutSessionId)
        : null;
    }
    if (fields.isRest !== undefined) {
      setPayload['days.$.isRest'] = fields.isRest;
    }
    if (fields.status !== undefined) {
      setPayload['days.$.status'] = fields.status;
    }
    if (fields.extraSessionIds !== undefined) {
      setPayload['days.$.extraSessionIds'] = fields.extraSessionIds.map(
        (id) => new Types.ObjectId(id),
      );
    }

    await this.weekLogModel.updateOne(
      { _id: new Types.ObjectId(weekLogId), 'days.order': order },
      { $set: setPayload },
    );
  }

  // ─── Raw access (para mutaciones de subdocumentos con .save()) ───────────────

  async findRaw(id: string): Promise<any> {
    return this.weekLogModel.findById(id).exec();
  }

  async findRawByUserId(id: string, userId: string): Promise<any> {
    return this.weekLogModel
      .findOne({
        _id: id,
        userId: new Types.ObjectId(userId),
        deleted: { $ne: true },
      })
      .exec();
  }

  async findActiveRaw(userId: string): Promise<any> {
    return this.weekLogModel
      .findOne({
        userId: new Types.ObjectId(userId),
        active: true,
        deleted: { $ne: true },
      })
      .exec();
  }

  async updateDayStatus(
    weekLogId: string,
    order: number,
    data: Partial<WeekLogDayDomain>,
  ) {
    await this.weekLogModel.updateOne(
      { _id: new Types.ObjectId(weekLogId), 'days.order': order },
      {
        $set: {
          'days.$.isRest': data.isRest,
          'days.$.status': data.status,
          'days.$.workoutSessionId': data.workoutSessionId
            ? new Types.ObjectId(data.workoutSessionId)
            : null,
        },
      },
    );
  }

  async updateWeekLog(id: string, update: UpdateQuery<WeekLog>) {
    const updatedDoc = await this.weekLogModel
      .findByIdAndUpdate(id, update, {
        new: true,
        runValidators: true,
      })
      .exec();

    if (!updatedDoc) {
      throw new Error(`WeekLog con ID "${id}" no encontrado`);
    }

    return this.mapToDomain(updatedDoc);
  }

  // ─── Mapper ─────────────────────────────────────────────────────────────────

  private mapToDomain(doc: WeekLogDocument): WeekLogDomain {
    const obj = doc.toObject();

    const days = obj.days.map((day: any) => {
      const session = day.workoutSessionId;
      const isPopulated = session && typeof session === 'object' && session._id;

      return new WeekLogDayDomain(
        day.order,
        day.date,
        day.isRest,
        isPopulated
          ? session._id.toString()
          : session
            ? session.toString()
            : null,
        (day.extraSessionIds ?? []).map((id: any) => {
          if (id && typeof id === 'object' && id._id) {
            return id._id.toString();
          }
          return id.toString();
        }),
        day.status,
        isPopulated ? (session.exercises ?? []) : [],
      );
    });

    return new WeekLogDomain(
      obj._id.toString(),
      obj.userId.toString(),
      obj.startDate,
      obj.endDate,
      obj.planId ? obj.planId.toString() : null,
      days,
      obj.completed,
      obj.active,
      obj.notes,
    );
  }
}
