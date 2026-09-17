import { Test, TestingModule } from '@nestjs/testing';
import { SaveTopExercisesUseCase } from './save-top-exercises.use-case';
import { STATS_REPOSITORY } from '../../domain/interfaces/repositories/stats.repository.interface';
import {
  UserTopExerciseDomain,
  TopExerciseEntryDomain,
} from '../../domain/entities/stats.domain';

describe('SaveTopExercisesUseCase', () => {
  let useCase: SaveTopExercisesUseCase;

  const mockRepository = {
    upsertTopExercises: jest.fn(),
  };

  const userId = '507f1f77bcf86cd799439011';
  const computedAt = new Date('2026-09-01T12:00:00.000Z');

  const exercisesInput = [
    {
      rank: 1,
      exerciseId: '507f1f77bcf86cd799439021',
      name: 'Squat',
      category: 'legs',
      totalSessions: 12,
      totalVolume: 24000,
      avgVolumePerSession: 2000,
    },
    {
      rank: 2,
      exerciseId: '507f1f77bcf86cd799439022',
      name: 'Bench Press',
      category: 'chest',
      totalSessions: 8,
      totalVolume: 9600,
      avgVolumePerSession: 1200,
    },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaveTopExercisesUseCase,
        { provide: STATS_REPOSITORY, useValue: mockRepository },
      ],
    }).compile();

    useCase = module.get<SaveTopExercisesUseCase>(SaveTopExercisesUseCase);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('maps input entries to TopExerciseEntryDomain and delegates to the repository', async () => {
    const expectedDomain = new UserTopExerciseDomain(
      null,
      userId,
      computedAt,
      exercisesInput.map(
        (e) =>
          new TopExerciseEntryDomain(
            e.rank,
            e.exerciseId,
            e.name,
            e.category,
            e.totalSessions,
            e.totalVolume,
            e.avgVolumePerSession,
          ),
      ),
    );
    mockRepository.upsertTopExercises.mockResolvedValue(expectedDomain);

    const result = await useCase.execute(
      userId,
      exercisesInput,
      computedAt,
    );

    expect(mockRepository.upsertTopExercises).toHaveBeenCalledTimes(1);
    const [calledUserId, calledDomain] =
      mockRepository.upsertTopExercises.mock.calls[0];

    expect(calledUserId).toBe(userId);
    expect(calledDomain).toBeInstanceOf(UserTopExerciseDomain);
    expect(calledDomain).toEqual(expectedDomain);
    expect(result).toEqual(expectedDomain);
  });

  it('maps each entry field in order', async () => {
    const resultDomain = new UserTopExerciseDomain(null, userId, computedAt, [
      new TopExerciseEntryDomain(
        1,
        '507f1f77bcf86cd799439021',
        'Squat',
        'legs',
        12,
        24000,
        2000,
      ),
    ]);
    mockRepository.upsertTopExercises.mockResolvedValue(resultDomain);

    await useCase.execute(userId, [exercisesInput[0]], computedAt);

    const [, calledDomain] = mockRepository.upsertTopExercises.mock.calls[0];
    const entry = calledDomain.exercises[0];

    expect(entry).toBeInstanceOf(TopExerciseEntryDomain);
    expect(entry.rank).toBe(1);
    expect(entry.exerciseId).toBe('507f1f77bcf86cd799439021');
    expect(entry.name).toBe('Squat');
    expect(entry.category).toBe('legs');
    expect(entry.totalSessions).toBe(12);
    expect(entry.totalVolume).toBe(24000);
    expect(entry.avgVolumePerSession).toBe(2000);
    expect(calledDomain.computedAt).toBe(computedAt);
    expect(calledDomain.userId).toBe(userId);
  });

  it('maps an empty exercises array', async () => {
    const emptyDomain = new UserTopExerciseDomain(null, userId, computedAt, []);
    mockRepository.upsertTopExercises.mockResolvedValue(emptyDomain);

    await useCase.execute(userId, [], computedAt);

    expect(mockRepository.upsertTopExercises).toHaveBeenCalledTimes(1);
    const [, calledDomain] = mockRepository.upsertTopExercises.mock.calls[0];
    expect(calledDomain.exercises).toEqual([]);
  });
});