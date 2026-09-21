import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { BadRequestException } from '@nestjs/common';
import { TrainingHistoryService } from './training-history.service';
import { WeekLog } from '../week-log/infrastructure/schemas/week-log.schema';
import { DayLog } from '../day-log/infrastructure/schemas/day-log.schema';
import { localDateToUtc } from 'src/common/utils/date.utils';
import {
  DayType,
  TrainingStatus,
} from './presentation/entities/training-history.entity';

const TZ = 'America/Argentina/Buenos_Aires';

function buildDay(
  order: number,
  date: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    order,
    date: localDateToUtc(date, TZ),
    isRest: false,
    workoutSessionId: null,
    extraSessionIds: [],
    status: 'pending',
    ...overrides,
  };
}

describe('TrainingHistoryService', () => {
  let service: TrainingHistoryService;
  let weekLogModel: any;
  let dayLogModel: any;

  const weekLogQuery = {
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  };
  const dayLogQuery = {
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  };

  beforeEach(async () => {
    weekLogQuery.exec.mockReset();
    dayLogQuery.exec.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrainingHistoryService,
        { provide: getModelToken(WeekLog.name), useValue: { find: jest.fn().mockReturnValue(weekLogQuery) } },
        { provide: getModelToken(DayLog.name), useValue: { find: jest.fn().mockReturnValue(dayLogQuery) } },
      ],
    }).compile();

    service = module.get<TrainingHistoryService>(TrainingHistoryService);
    weekLogModel = module.get(getModelToken(WeekLog.name));
    dayLogModel = module.get(getModelToken(DayLog.name));
  });

  const userId = new Types.ObjectId().toString();

  it('TEST-001 WEEK_LOG: maps isRest→rest, passes statuses through, resolves ids and exposes weekLogReference (Date)', async () => {
    const weekLogId = new Types.ObjectId();
    const wsId = new Types.ObjectId();
    const esId = new Types.ObjectId();
    const startDate = localDateToUtc('2026-01-01', TZ);
    const endDate = localDateToUtc('2026-01-07', TZ);

    const weekLog = {
      _id: weekLogId as any,
      startDate,
      endDate,
      completed: true,
      active: false,
      notes: 'done',
      days: [
        buildDay(1, '2026-01-05', { isRest: true, status: 'pending' }),
        buildDay(2, '2026-01-06', {
          status: 'complete',
          workoutSessionId: { _id: wsId },
          extraSessionIds: [
            {
              _id: esId,
              userId,
              workoutSessionId: wsId,
              category: 'cardio',
              date: localDateToUtc('2026-01-06', TZ),
              discipline: 'running',
              duration: 30,
              intensityLevel: 3,
              calories: 320,
              notes: '',
            },
          ],
        }),
        buildDay(3, '2026-02-01', { status: 'complete' }),
      ],
    };

    weekLogQuery.exec.mockResolvedValue([weekLog]);
    dayLogQuery.exec.mockResolvedValue([]);

    const result = await service.getTrainingCalendar(userId, 2026, 1);

    expect(result.year).toBe(2026);
    expect(result.month).toBe(1);
    expect(result.days).toHaveLength(2);

    const restDay = result.days[0];
    expect(restDay.date).toBe('2026-01-05');
    expect(restDay.type).toBe(DayType.WEEK_LOG);
    expect(restDay.status).toBe(TrainingStatus.REST);
    expect(restDay.workoutSessionId).toBeUndefined();
    expect(restDay.dayLogId).toBeUndefined();
    expect(restDay.extraSessions).toEqual([]);

    const trainedDay = result.days[1];
    expect(trainedDay.date).toBe('2026-01-06');
    expect(trainedDay.status).toBe(TrainingStatus.COMPLETE);
    expect(trainedDay.workoutSessionId).toBe(wsId.toString());
    expect(trainedDay.extraSessionIds).toEqual([esId.toString()]);
    expect(trainedDay.extraSessions).toEqual([
      {
        id: esId.toString(),
        userId,
        workoutSessionId: wsId.toString(),
        category: 'cardio',
        date: localDateToUtc('2026-01-06', TZ),
        discipline: 'running',
        duration: 30,
        intensityLevel: 3,
        calories: 320,
        notes: undefined,
      },
    ]);
    expect(trainedDay.weekLogReference).toEqual({
      id: weekLogId.toString(),
      startDate,
      endDate,
      completed: true,
      active: false,
      notes: 'done',
    });

    expect(result.days.find((d) => d.date === '2026-02-01')).toBeUndefined();
  });

  it('TEST-002 DAY_LOG: maps status, dayLogId, session ids and null weekLogReference', async () => {
    const dayLogId = new Types.ObjectId();
    const wsId = new Types.ObjectId();
    const esId = new Types.ObjectId();

    weekLogQuery.exec.mockResolvedValue([]);
    dayLogQuery.exec.mockResolvedValue([
      {
        _id: dayLogId as any,
        date: localDateToUtc('2026-01-15', TZ),
        status: 'skipped',
        workoutSessionId: wsId as any,
        extraSessionIds: [
          {
            _id: esId,
            userId,
            workoutSessionId: wsId,
            category: 'cardio',
            date: localDateToUtc('2026-01-15', TZ),
            discipline: 'cycling',
            duration: 45,
            intensityLevel: 4,
            calories: null,
            notes: 'cooldown',
          },
        ],
      },
    ]);

    const result = await service.getTrainingCalendar(userId, 2026, 1);

    expect(result.days).toHaveLength(1);
    const day = result.days[0];
    expect(day.date).toBe('2026-01-15');
    expect(day.type).toBe(DayType.DAY_LOG);
    expect(day.status).toBe(TrainingStatus.SKIPPED);
    expect(day.dayLogId).toBe(dayLogId.toString());
    expect(day.workoutSessionId).toBe(wsId.toString());
    expect(day.extraSessionIds).toEqual([esId.toString()]);
    expect(day.extraSessions).toEqual([
      {
        id: esId.toString(),
        userId,
        workoutSessionId: wsId.toString(),
        category: 'cardio',
        date: localDateToUtc('2026-01-15', TZ),
        discipline: 'cycling',
        duration: 45,
        intensityLevel: 4,
        calories: undefined,
        notes: 'cooldown',
      },
    ]);
    expect(day.weekLogReference).toBeUndefined();
  });

  it('TEST-003 window/timezone: month range boundary via UTC; out-of-range days are excluded and default timezone applies', async () => {
    const overlappingWeek = {
      _id: new Types.ObjectId() as any,
      startDate: localDateToUtc('2026-01-30', TZ),
      endDate: localDateToUtc('2026-02-05', TZ),
      completed: false,
      active: false,
      notes: '',
      days: [
        buildDay(1, '2026-01-30', { status: 'pending' }),
        buildDay(2, '2026-02-01', { status: 'pending' }),
      ],
    };

    weekLogQuery.exec.mockResolvedValue([overlappingWeek]);
    dayLogQuery.exec.mockResolvedValue([]);

    const result = await service.getTrainingCalendar(userId, 2026, 1);

    expect(result.days).toEqual([expect.objectContaining({ date: '2026-01-30' })]);
    expect(result.days.find((d) => d.date === '2026-02-01')).toBeUndefined();

    const weekFilter = weekLogModel.find.mock.calls[0][0];
    expect(weekFilter).toEqual({
      userId: expect.any(Types.ObjectId),
      deleted: { $ne: true },
      startDate: { $lt: localDateToUtc('2026-02-01', TZ) },
      endDate: { $gte: localDateToUtc('2026-01-01', TZ) },
    });

    const dayFilter = dayLogModel.find.mock.calls[0][0];
    expect(dayFilter).toEqual({
      userId: expect.any(Types.ObjectId),
      deleted: { $ne: true },
      date: {
        $gte: localDateToUtc('2026-01-01', TZ),
        $lt: localDateToUtc('2026-02-01', TZ),
      },
    });
  });

  it('TEST-004 merge/sort/precedence: DAY_LOG is dropped when a WEEK_LOG entry exists for the same date; result sorted by date', async () => {
    const weekLog = {
      _id: new Types.ObjectId() as any,
      startDate: localDateToUtc('2026-01-10', TZ),
      endDate: localDateToUtc('2026-01-16', TZ),
      completed: false,
      active: false,
      notes: '',
      days: [
        buildDay(4, '2026-01-10', { status: 'pending' }),
        buildDay(5, '2026-01-11', { status: 'pending' }),
      ],
    };

    weekLogQuery.exec.mockResolvedValue([weekLog]);
    dayLogQuery.exec.mockResolvedValue([
      {
        _id: new Types.ObjectId() as any,
        date: localDateToUtc('2026-01-15', TZ),
        status: 'complete',
        workoutSessionId: null,
        extraSessionIds: [],
      },
      {
        _id: new Types.ObjectId() as any,
        date: localDateToUtc('2026-01-10', TZ),
        status: 'complete',
        workoutSessionId: null,
        extraSessionIds: [],
      },
    ]);

    const result = await service.getTrainingCalendar(userId, 2026, 1);

    expect(result.days.map((d) => d.date)).toEqual([
      '2026-01-10',
      '2026-01-11',
      '2026-01-15',
    ]);

    const collision = result.days.find((d) => d.date === '2026-01-10');
    expect(collision.type).toBe(DayType.WEEK_LOG);
    expect(collision.dayLogId).toBeUndefined();
  });

  it('TEST-005 validation: invalid month, year and timezone reject with BadRequestException', async () => {
    await expect(service.getTrainingCalendar(userId, 2026, 0)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.getTrainingCalendar(userId, 2026, 13)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.getTrainingCalendar(userId, 2026, 1.5)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.getTrainingCalendar(userId, 0, 1)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.getTrainingCalendar(userId, -5, 1)).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      service.getTrainingCalendar(userId, 2026, 1, 'Invalid/Zone'),
    ).rejects.toThrow(BadRequestException);

    expect(weekLogModel.find).not.toHaveBeenCalled();
    expect(dayLogModel.find).not.toHaveBeenCalled();
  });
});