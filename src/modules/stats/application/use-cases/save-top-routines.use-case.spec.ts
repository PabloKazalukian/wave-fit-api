import { Test, TestingModule } from '@nestjs/testing';
import { SaveTopRoutinesUseCase } from './save-top-routines.use-case';
import { STATS_REPOSITORY } from '../../domain/interfaces/repositories/stats.repository.interface';
import {
  UserTopRoutineDomain,
  TopRoutineEntryDomain,
} from '../../domain/entities/stats.domain';

describe('SaveTopRoutinesUseCase', () => {
  let useCase: SaveTopRoutinesUseCase;

  const mockRepository = {
    upsertTopRoutines: jest.fn(),
  };

  const userId = '507f1f77bcf86cd799439011';
  const computedAt = new Date('2026-09-01T12:00:00.000Z');

  const routinesInput = [
    {
      rank: 1,
      planId: '507f1f77bcf86cd799439031',
      name: 'Full Body A',
      totalWeeks: 6,
      totalSessions: 18,
      adherenceRate: 85.71,
    },
    {
      rank: 2,
      planId: '507f1f77bcf86cd799439032',
      name: 'Upper/Lower',
      totalWeeks: 4,
      totalSessions: 16,
      adherenceRate: 92.86,
    },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaveTopRoutinesUseCase,
        { provide: STATS_REPOSITORY, useValue: mockRepository },
      ],
    }).compile();

    useCase = module.get<SaveTopRoutinesUseCase>(SaveTopRoutinesUseCase);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('maps input entries to TopRoutineEntryDomain and delegates to the repository', async () => {
    const expectedDomain = new UserTopRoutineDomain(
      null,
      userId,
      computedAt,
      routinesInput.map(
        (r) =>
          new TopRoutineEntryDomain(
            r.rank,
            r.planId,
            r.name,
            r.totalWeeks,
            r.totalSessions,
            r.adherenceRate,
          ),
      ),
    );
    mockRepository.upsertTopRoutines.mockResolvedValue(expectedDomain);

    const result = await useCase.execute(
      userId,
      routinesInput,
      computedAt,
    );

    expect(mockRepository.upsertTopRoutines).toHaveBeenCalledTimes(1);
    const [calledUserId, calledDomain] =
      mockRepository.upsertTopRoutines.mock.calls[0];

    expect(calledUserId).toBe(userId);
    expect(calledDomain).toBeInstanceOf(UserTopRoutineDomain);
    expect(calledDomain).toEqual(expectedDomain);
    expect(result).toEqual(expectedDomain);
  });

  it('maps each entry field in order', async () => {
    mockRepository.upsertTopRoutines.mockResolvedValue(null);

    await useCase.execute(userId, [routinesInput[0]], computedAt);

    const [, calledDomain] = mockRepository.upsertTopRoutines.mock.calls[0];
    const entry = calledDomain.routines[0];

    expect(entry).toBeInstanceOf(TopRoutineEntryDomain);
    expect(entry.rank).toBe(1);
    expect(entry.planId).toBe('507f1f77bcf86cd799439031');
    expect(entry.name).toBe('Full Body A');
    expect(entry.totalWeeks).toBe(6);
    expect(entry.totalSessions).toBe(18);
    expect(entry.adherenceRate).toBe(85.71);
    expect(calledDomain.computedAt).toBe(computedAt);
    expect(calledDomain.userId).toBe(userId);
  });

  it('maps an empty routines array', async () => {
    const emptyDomain = new UserTopRoutineDomain(null, userId, computedAt, []);
    mockRepository.upsertTopRoutines.mockResolvedValue(emptyDomain);

    await useCase.execute(userId, [], computedAt);

    expect(mockRepository.upsertTopRoutines).toHaveBeenCalledTimes(1);
    const [, calledDomain] = mockRepository.upsertTopRoutines.mock.calls[0];
    expect(calledDomain.routines).toEqual([]);
  });
});