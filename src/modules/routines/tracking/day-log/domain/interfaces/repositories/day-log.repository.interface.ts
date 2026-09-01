import { UpdateQuery } from 'mongoose';
import { DayLogDomain } from '../../entities/day-log.domain';
import { DayLog } from '../../../presentation/entities/day-log.entity';

export const DAY_LOG_REPOSITORY = 'DAY_LOG_REPOSITORY';

export interface IDayLogRepository {
  findOne(id: string, userId: string): Promise<DayLogDomain | null>;
  findAllByUser(
    userId: string,
    limit?: number,
    offset?: number,
  ): Promise<DayLogDomain[]>;
  findActive(userId: string): Promise<DayLogDomain | null>;
  create(dayLog: DayLogDomain): Promise<DayLogDomain>;
  findByIdAndUpdate(
    id: string,
    updateQuery: UpdateQuery<DayLog>,
    options?: { new?: boolean; runValidators?: boolean },
  ): Promise<DayLogDomain>;
  findByIdAndSoftDelete(id: string, userId: string): Promise<DayLogDomain | null>;
  delete(id: string): Promise<void>;
  findRaw(id: string): Promise<any>;
  findActiveRaw(userId: string): Promise<any>;
  updateStatus(
    id: string,
    status: string,
    workoutSessionId: string | null,
  ): Promise<void>;
}
