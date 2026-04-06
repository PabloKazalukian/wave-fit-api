import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, UpdateQuery } from 'mongoose';
import { WeekLog } from '../schemas/week-log.schema';
import { IWeekLogRepository } from '../../domain/interfaces/repositories/week-log.repository.interface';
import {
  WeekLogDayDomain,
  WeekLogDomain,
} from '../../domain/entities/week-log.domain';

@Injectable()
export class WeekLogRepository implements IWeekLogRepository {
  constructor(
    @InjectModel(WeekLog.name)
    private readonly weekLogModel: Model<WeekLog>,
  ) {}

  // ─── Queries ────────────────────────────────────────────────────────────────

  async findOne(id: string, userId: string): Promise<WeekLogDomain | null> {
    const doc = await this.weekLogModel
      .findOne({ _id: id, userId })
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
    const query = this.weekLogModel
      .find({ userId })
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
      .findOne({ userId, active: true })
      .populate('days.workoutSessionId')
      .exec();

    if (!doc) return null;
    return this.mapToDomain(doc);
  }

  async findPlanById(planId: string): Promise<any> {
    return this.weekLogModel.findById(planId).exec();
  }

  // ─── Commands ────────────────────────────────────────────────────────────────

  async create(data: WeekLogDomain): Promise<WeekLogDomain> {
    const weekLog = new this.weekLogModel(data);
    await weekLog.save();

    if (data.planId) {
      await this.weekLogModel.updateOne(
        { _id: weekLog._id },
        { $set: { planId: new Types.ObjectId(data.planId) } },
      );
    }

    const populated = await this.weekLogModel
      .findById(weekLog._id)
      .populate('days.workoutSessionId')
      .exec();

    return this.mapToDomain(populated);
  }

  async createWithPlanId(data: WeekLogDomain): Promise<any> {
    const weekLog = new this.weekLogModel({
      _id: data.id,
      userId: data.userId,
      startDate: data.startDate,
      endDate: data.endDate,
      planId: data.planId ? new Types.ObjectId(data.planId) : null,
      days: data.days,
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
      .lean();

    if (!doc) {
      throw new NotFoundException(`WeekLog con ID "${id}" no encontrado`);
    }

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
      { _id: weekLogId, 'days.order': order },
      { $set: setPayload },
    );
  }

  // ─── Raw access (para mutaciones de subdocumentos con .save()) ───────────────

  async findRaw(id: string): Promise<any> {
    return this.weekLogModel.findById(id).exec();
  }

  async findRawByUserId(id: string, userId: string): Promise<any> {
    return this.weekLogModel.findOne({ _id: id, userId }).exec();
  }

  async findActiveRaw(userId: string): Promise<any> {
    return this.weekLogModel.findOne({ userId, active: true }).exec();
  }

  // ─── Mapper ─────────────────────────────────────────────────────────────────

  private mapToDomain(doc: any): WeekLogDomain {
    const obj = doc.toObject ? doc.toObject() : doc;

    return {
      id: obj._id.toString(),
      userId: obj.userId.toString(),
      startDate: obj.startDate,
      endDate: obj.endDate,
      planId: obj.planId ? obj.planId.toString() : null,
      completed: obj.completed,
      active: obj.active,
      notes: obj.notes,
      days: obj.days.map((day: any) => {
        const session = day.workoutSessionId;
        const isPopulated =
          session && typeof session === 'object' && session._id;

        return {
          order: day.order,
          date: day.date,
          isRest: day.isRest,
          status: day.status,
          workoutSessionId: isPopulated
            ? session._id.toString()
            : (session?.toString() ?? null),
          extraSessionIds: (day.extraSessionIds ?? []).map((id: any) =>
            id.toString(),
          ),
          exercises: isPopulated ? (session.exercises ?? []) : [],
        };
      }),
    };
  }
}
