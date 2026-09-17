import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { GetRawDataForWorkerUseCase } from './get-raw-data-for-worker.use-case';
import { WorkoutSession } from '../../infrastructure/schemas/workout-session-reference.schema';
import { WeekLog } from '../../infrastructure/schemas/week-log-reference.schema';
import { Exercise } from '../../infrastructure/schemas/exercise-reference.schema';
import { RoutinePlan } from '../../infrastructure/schemas/routine-plan-reference.schema';
import { UserStrengthMetric } from '../../infrastructure/schemas/strength-metric-reference.schema';
import { WorkerRawDataDomain } from '../../domain/entities/stats.domain';

const buildQuery = (value: any) => ({
  sort: jest.fn().mockReturnThis(),
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(value),
});

describe('GetRawDataForWorkerUseCase', () => {
  let useCase: GetRawDataForWorkerUseCase;

  const workoutSessionModelMock = { find: jest.fn() };
  const weekLogModelMock = { find: jest.fn() };
  const exerciseModelMock = { find: jest.fn() };
  const routinePlanModelMock = { find: jest.fn() };
  const strengthMetricModelMock = { find: jest.fn() };

  const userId = '507f1f77bcf86cd799439011';
  const userIdObjectId = new Types.ObjectId(userId);

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetRawDataForWorkerUseCase,
        {
          provide: getModelToken(WorkoutSession.name),
          useValue: workoutSessionModelMock,
        },
        { provide: getModelToken(WeekLog.name), useValue: weekLogModelMock },
        { provide: getModelToken(Exercise.name), useValue: exerciseModelMock },
        {
          provide: getModelToken(RoutinePlan.name),
          useValue: routinePlanModelMock,
        },
        {
          provide: getModelToken(UserStrengthMetric.name),
          useValue: strengthMetricModelMock,
        },
      ],
    }).compile();

    useCase = module.get<GetRawDataForWorkerUseCase>(
      GetRawDataForWorkerUseCase,
    );
  });

  it('queries WorkoutSession filtered by user, non-deleted and complete, sorted by date', async () => {
    workoutSessionModelMock.find.mockReturnValue(buildQuery([]));
    weekLogModelMock.find.mockReturnValue(buildQuery([]));
    exerciseModelMock.find.mockReturnValue(buildQuery([]));
    routinePlanModelMock.find.mockReturnValue(buildQuery([]));
    strengthMetricModelMock.find.mockReturnValue(buildQuery([]));

    await useCase.execute(userId);

    const [filter] = workoutSessionModelMock.find.mock.calls[0];
    const query = workoutSessionModelMock.find.mock.results[0].value;
    expect(filter.userId.toString()).toBe(userId);
    expect(filter.deleted).toEqual({ $ne: true });
    expect(filter.status).toBe('complete');
    expect(query.sort).toHaveBeenCalledWith({ date: 1 });
  });

  it('queries WeekLog filtered by user and non-deleted, sorted by startDate', async () => {
    workoutSessionModelMock.find.mockReturnValue(buildQuery([]));
    weekLogModelMock.find.mockReturnValue(buildQuery([]));
    exerciseModelMock.find.mockReturnValue(buildQuery([]));
    routinePlanModelMock.find.mockReturnValue(buildQuery([]));
    strengthMetricModelMock.find.mockReturnValue(buildQuery([]));

    await useCase.execute(userId);

    const [filter] = weekLogModelMock.find.mock.calls[0];
    const query = weekLogModelMock.find.mock.results[0].value;
    expect(filter.userId.toString()).toBe(userId);
    expect(filter.deleted).toEqual({ $ne: true });
    expect(query.sort).toHaveBeenCalledWith({ startDate: 1 });
  });

  it('queries the full Exercise catalog without filters', async () => {
    workoutSessionModelMock.find.mockReturnValue(buildQuery([]));
    weekLogModelMock.find.mockReturnValue(buildQuery([]));
    exerciseModelMock.find.mockReturnValue(buildQuery([]));
    routinePlanModelMock.find.mockReturnValue(buildQuery([]));
    strengthMetricModelMock.find.mockReturnValue(buildQuery([]));

    await useCase.execute(userId);

    expect(exerciseModelMock.find).toHaveBeenCalledWith();
  });

  it('queries RoutinePlan scoped by createdBy', async () => {
    workoutSessionModelMock.find.mockReturnValue(buildQuery([]));
    weekLogModelMock.find.mockReturnValue(buildQuery([]));
    exerciseModelMock.find.mockReturnValue(buildQuery([]));
    routinePlanModelMock.find.mockReturnValue(buildQuery([]));
    strengthMetricModelMock.find.mockReturnValue(buildQuery([]));

    await useCase.execute(userId);

    const [filter] = routinePlanModelMock.find.mock.calls[0];
    expect(filter.createdBy.toString()).toBe(userId);
  });

  it('queries UserStrengthMetric filtered by user, sorted by measuredAt', async () => {
    workoutSessionModelMock.find.mockReturnValue(buildQuery([]));
    weekLogModelMock.find.mockReturnValue(buildQuery([]));
    exerciseModelMock.find.mockReturnValue(buildQuery([]));
    routinePlanModelMock.find.mockReturnValue(buildQuery([]));
    strengthMetricModelMock.find.mockReturnValue(buildQuery([]));

    await useCase.execute(userId);

    const [filter] = strengthMetricModelMock.find.mock.calls[0];
    const query = strengthMetricModelMock.find.mock.results[0].value;
    expect(filter.userId.toString()).toBe(userId);
    expect(query.sort).toHaveBeenCalledWith({ measuredAt: 1 });
  });

  it('maps documents to WorkerRawDataDomain converting ObjectIds to strings', async () => {
    const workoutSessions = [
      {
        _id: new Types.ObjectId('507f1f77bcf86cd7994390a1'),
        userId: userIdObjectId,
        date: new Date('2026-08-01T10:00:00.000Z'),
        routineDayId: new Types.ObjectId('507f1f77bcf86cd7994390a2'),
        status: 'complete',
        exercises: [
          {
            exerciseId: new Types.ObjectId('507f1f77bcf86cd7994390a3'),
            series: 3,
            sets: [
              { reps: 10, weights: 100 },
              { reps: 8, weights: 100 },
            ],
          },
        ],
      },
    ];
    const weekLogs = [
      {
        _id: new Types.ObjectId('507f1f77bcf86cd7994390b1'),
        userId: userIdObjectId,
        startDate: new Date('2026-08-03T00:00:00.000Z'),
        endDate: new Date('2026-08-09T00:00:00.000Z'),
        planId: new Types.ObjectId('507f1f77bcf86cd7994390b2'),
        completed: true,
        days: [
          {
            order: 1,
            date: new Date('2026-08-03T00:00:00.000Z'),
            isRest: false,
            status: 'complete',
          },
        ],
      },
    ];
    const exercises = [
      {
        _id: new Types.ObjectId('507f1f77bcf86cd7994390c1'),
        name: 'Squat',
        category: 'legs',
        usesWeight: true,
      },
    ];
    const routinePlans = [
      {
        _id: new Types.ObjectId('507f1f77bcf86cd7994390d1'),
        name: 'Full Body A',
        description: 'Plan A',
        createdBy: userIdObjectId,
      },
    ];
    const strengthMetrics = [
      {
        _id: new Types.ObjectId('507f1f77bcf86cd7994390e1'),
        exerciseKey: 'Sentadilla',
        oneRmKg: 140,
        measuredAt: new Date('2026-08-10T10:00:00.000Z'),
      },
    ];

    workoutSessionModelMock.find.mockReturnValue(buildQuery(workoutSessions));
    weekLogModelMock.find.mockReturnValue(buildQuery(weekLogs));
    exerciseModelMock.find.mockReturnValue(buildQuery(exercises));
    routinePlanModelMock.find.mockReturnValue(buildQuery(routinePlans));
    strengthMetricModelMock.find.mockReturnValue(buildQuery(strengthMetrics));

    const result: WorkerRawDataDomain = await useCase.execute(userId);

    expect(result.workoutSessions[0]._id).toBe(
      '507f1f77bcf86cd7994390a1',
    );
    expect(result.workoutSessions[0].userId).toBe(userId);
    expect(result.workoutSessions[0].routineDayId).toBe(
      '507f1f77bcf86cd7994390a2',
    );
    expect(result.workoutSessions[0].status).toBe('complete');
    expect(result.workoutSessions[0].date).toEqual(
      new Date('2026-08-01T10:00:00.000Z'),
    );
    expect(result.workoutSessions[0].exercises[0].exerciseId).toBe(
      '507f1f77bcf86cd7994390a3',
    );
    expect(result.workoutSessions[0].exercises[0].series).toBe(3);
    expect(result.workoutSessions[0].exercises[0].sets).toEqual([
      { reps: 10, weights: 100 },
      { reps: 8, weights: 100 },
    ]);

    expect(result.weekLogs[0]._id).toBe('507f1f77bcf86cd7994390b1');
    expect(result.weekLogs[0].userId).toBe(userId);
    expect(result.weekLogs[0].startDate).toEqual(
      new Date('2026-08-03T00:00:00.000Z'),
    );
    expect(result.weekLogs[0].endDate).toEqual(
      new Date('2026-08-09T00:00:00.000Z'),
    );
    expect(result.weekLogs[0].planId).toBe('507f1f77bcf86cd7994390b2');
    expect(result.weekLogs[0].completed).toBe(true);
    expect(result.weekLogs[0].days).toEqual([
      {
        order: 1,
        date: new Date('2026-08-03T00:00:00.000Z'),
        isRest: false,
        status: 'complete',
      },
    ]);

    expect(result.exercises[0]).toEqual({
      _id: '507f1f77bcf86cd7994390c1',
      name: 'Squat',
      category: 'legs',
      usesWeight: true,
    });

    expect(result.routinePlans[0]).toEqual({
      _id: '507f1f77bcf86cd7994390d1',
      name: 'Full Body A',
      description: 'Plan A',
      createdBy: userId,
    });

    expect(result.strengthMetrics[0]).toEqual({
      _id: '507f1f77bcf86cd7994390e1',
      exerciseKey: 'Sentadilla',
      oneRmKg: 140,
      measuredAt: new Date('2026-08-10T10:00:00.000Z'),
    });
  });

  it('returns empty arrays when no documents exist', async () => {
    workoutSessionModelMock.find.mockReturnValue(buildQuery([]));
    weekLogModelMock.find.mockReturnValue(buildQuery([]));
    exerciseModelMock.find.mockReturnValue(buildQuery([]));
    routinePlanModelMock.find.mockReturnValue(buildQuery([]));
    strengthMetricModelMock.find.mockReturnValue(buildQuery([]));

    const result = await useCase.execute(userId);

    expect(result).toEqual({
      workoutSessions: [],
      weekLogs: [],
      exercises: [],
      routinePlans: [],
      strengthMetrics: [],
    });
  });
});