import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WeekLog } from '../week-log/infrastructure/schemas/week-log.schema';
import {
  utcToLocalDate,
  localDateToUtc,
  addDaysToLocalDate,
} from '../../../../common/utils/date.utils';
import {
  CalendarDay,
  DayType,
  TrainingStatus,
  WeekLogReference,
  TrainingCalendarResponse,
} from './presentation/entities/training-history.entity';

const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

@Injectable()
export class TrainingHistoryService {
  constructor(
    @InjectModel(WeekLog.name)
    private readonly weekLogModel: Model<WeekLog>,
  ) {}

  async getTrainingCalendar(
    userId: string,
    year: number,
    month: number,
    timezone: string = DEFAULT_TIMEZONE,
  ): Promise<TrainingCalendarResponse> {
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const monthEndLocal = addDaysToLocalDate(
      monthStart,
      new Date(year, month, 0).getDate() - 1,
    );

    const rangeStartUtc = localDateToUtc(monthStart, timezone);
    const rangeEndUtc = localDateToUtc(
      addDaysToLocalDate(monthEndLocal, 1),
      timezone,
    );

    const weekLogs = await this.weekLogModel
      .find({
        userId: new Types.ObjectId(userId),
        deleted: { $ne: true },
        startDate: { $lt: rangeEndUtc },
        endDate: { $gte: rangeStartUtc },
      })
      .populate('days.workoutSessionId')
      .populate('days.extraSessionIds')
      .exec();

    const calendarDays: CalendarDay[] = [];

    for (const weekLog of weekLogs) {
      const ref: WeekLogReference = {
        id: (weekLog._id as Types.ObjectId).toString(),
        startDate: weekLog.startDate,
        endDate: weekLog.endDate,
        completed: weekLog.completed,
        active: weekLog.active,
        notes: weekLog.notes,
      };

      for (const day of weekLog.days) {
        const dayLocalDate = utcToLocalDate(day.date, timezone);

        if (dayLocalDate >= monthStart && dayLocalDate <= monthEndLocal) {
          calendarDays.push({
            date: dayLocalDate,
            type: DayType.WEEK_LOG,
            status: this.mapDayStatus(day),
            workoutSessionId: this.resolveId(day.workoutSessionId) ?? undefined,
            extraSessionIds: (day.extraSessionIds ?? [])
              .map((id: any) => this.resolveId(id))
              .filter((id): id is string => id !== null),
            weekLogReference: ref,
          });
        }
      }
    }

    calendarDays.sort((a, b) => a.date.localeCompare(b.date));

    return { year, month, days: calendarDays };
  }

  private mapDayStatus(day: any): TrainingStatus {
    if (day.isRest) return TrainingStatus.REST;
    return day.status as TrainingStatus;
  }

  private resolveId(value: any): string | null {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (value._id) return value._id.toString();
    return value.toString();
  }
}
