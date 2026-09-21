import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WeekLog } from '../week-log/infrastructure/schemas/week-log.schema';
import { DayLog } from '../day-log/infrastructure/schemas/day-log.schema';
import { ExtraSession } from '../extra-session/entities/extra-session.entity';
import {
  LocalDate,
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
    @InjectModel(DayLog.name)
    private readonly dayLogModel: Model<DayLog>,
  ) {}

  async getTrainingCalendar(
    userId: string,
    year: number,
    month: number,
    timezone: string = DEFAULT_TIMEZONE,
  ): Promise<TrainingCalendarResponse> {
    this.validateInput(year, month, timezone);

    const monthStart: LocalDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthEndLocal: LocalDate = addDaysToLocalDate(
      monthStart,
      daysInMonth - 1,
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

    const dayLogs = await this.dayLogModel
      .find({
        userId: new Types.ObjectId(userId),
        deleted: { $ne: true },
        date: { $gte: rangeStartUtc, $lt: rangeEndUtc },
      })
      .populate('extraSessionIds')
      .exec();

    const daysByDate = new Map<string, CalendarDay>();

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
          daysByDate.set(dayLocalDate, {
            date: dayLocalDate,
            type: DayType.WEEK_LOG,
            status: this.mapDayStatus(day),
            workoutSessionId: this.resolveId(day.workoutSessionId) ?? undefined,
            extraSessionIds: (day.extraSessionIds ?? [])
              .map((id: any) => this.resolveId(id))
              .filter((id): id is string => id !== null),
            extraSessions: this.resolveExtraSessions(day.extraSessionIds),
            weekLogReference: ref,
          });
        }
      }
    }

    for (const dayLog of dayLogs) {
      const dayLocalDate = utcToLocalDate(dayLog.date, timezone);

      if (daysByDate.has(dayLocalDate)) continue;

      daysByDate.set(dayLocalDate, {
        date: dayLocalDate,
        type: DayType.DAY_LOG,
        status: dayLog.status as TrainingStatus,
        workoutSessionId: this.resolveId(dayLog.workoutSessionId) ?? undefined,
        extraSessionIds: (dayLog.extraSessionIds ?? [])
          .map((id: any) => this.resolveId(id))
          .filter((id): id is string => id !== null),
        extraSessions: this.resolveExtraSessions(dayLog.extraSessionIds),
        dayLogId: (dayLog._id as Types.ObjectId).toString(),
      });
    }

    const days = Array.from(daysByDate.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    return { year, month, days };
  }

  private validateInput(year: number, month: number, timezone: string): void {
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException(`Invalid month: ${month}`);
    }
    if (!Number.isInteger(year) || year <= 0) {
      throw new BadRequestException(`Invalid year: ${year}`);
    }
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    } catch {
      throw new BadRequestException(`Invalid timezone: ${timezone}`);
    }
  }

  private mapDayStatus(day: any): TrainingStatus {
    if (day.isRest) return TrainingStatus.REST;
    return day.status as TrainingStatus;
  }

  private resolveExtraSessions(sessions: any[]): ExtraSession[] {
    return (sessions ?? [])
      .map((session: any): ExtraSession | null => {
        if (!session || typeof session !== 'object' || !session._id) return null;
        return {
          id: session._id.toString(),
          userId: session.userId?.toString() ?? '',
          workoutSessionId: session.workoutSessionId?.toString() ?? '',
          category: session.category,
          date: session.date,
          discipline: session.discipline,
          duration: session.duration,
          intensityLevel: session.intensityLevel,
          calories: session.calories ?? undefined,
          notes:
            session.notes !== undefined && session.notes !== ''
              ? session.notes
              : undefined,
        };
      })
      .filter((session): session is ExtraSession => session !== null);
  }

  private resolveId(value: any): string | null {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (value._id) return value._id.toString();
    return value.toString();
  }
}