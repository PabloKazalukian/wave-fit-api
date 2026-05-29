import { UpdateQuery } from 'mongoose';
import {
  WeekLogDayDomain,
  WeekLogDomain,
  WorkoutSessionCreationData,
} from '../../entities/week-log.domain';
import { WeekLog } from '../../../presentation/entities/week-log.entity';

export const WEEK_LOG_REPOSITORY = 'WEEK_LOG_REPOSITORY';

export interface IWeekLogRepository {
  findOne(id: string, userId: string): Promise<WeekLogDomain | null>;
  findAllByUser(
    userId: string,
    limit?: number,
    offset?: number,
  ): Promise<WeekLogDomain[]>;
  findActive(userId: string): Promise<WeekLogDomain | null>;
  create(
    weekLog: WeekLogDomain,
    sessions?: WorkoutSessionCreationData[],
  ): Promise<WeekLogDomain>;
  createWithPlanId(data: WeekLogDomain): Promise<any>;
  findByIdAndUpdate(
    id: string,
    updateQuery: UpdateQuery<WeekLog>,
    options?: { new?: boolean; runValidators?: boolean },
  ): Promise<WeekLogDomain>;
  delete(id: string): Promise<void>;
  updateDayField(
    weekLogId: string,
    order: number,
    fields: Partial<WeekLogDayDomain>,
  ): Promise<void>;
  findRaw(id: string): Promise<any>;
  findRawByUserId(id: string, userId: string): Promise<any>;
  findActiveRaw(userId: string): Promise<any>;
  findPlanById(planId: string): Promise<any>;
  updateDayStatus(
    weekLogId: string,
    order: number,
    data: Partial<WeekLogDayDomain>,
  ): Promise<void>;
  findByIdAndSoftDelete(id: string): Promise<WeekLogDomain | null>;
  updateWeekLog(
    id: string,
    update: UpdateQuery<WeekLog>,
  ): Promise<WeekLogDomain>;

  // update(id: string, updateQuery: UpdateQuery<WeekLog>): Promise<WeekLog>;
}
