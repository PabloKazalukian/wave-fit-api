import { Test, TestingModule } from '@nestjs/testing';
import { SavePersonalRecordsUseCase } from './save-personal-records.use-case';
import { STATS_REPOSITORY } from '../../domain/interfaces/repositories/stats.repository.interface';
import {
  UserPersonalRecordDomain,
  PersonalRecordEntryDomain,
} from '../../domain/entities/stats.domain';

describe('SavePersonalRecordsUseCase', () => {
  let useCase: SavePersonalRecordsUseCase;

  const mockRepository = {
    upsertPersonalRecords: jest.fn(),
  };

  const userId = '507f1f77bcf86cd799439011';
  const computedAt = new Date('2026-09-01T12:00:00.000Z');

  const recordsInput = [
    {
      exerciseId: '507f1f77bcf86cd799439041',
      exerciseName: 'Squat',
      category: 'legs',
      oneRmEstimated: 140,
      bestWeight: 120,
      bestReps: 5,
      bestVolume: 3000,
      achievedAt: new Date('2026-08-15T10:00:00.000Z'),
      previousOneRm: 135,
    },
    {
      exerciseId: '507f1f77bcf86cd799439042',
      exerciseName: 'Bench Press',
      category: 'chest',
      oneRmEstimated: 100,
      bestWeight: 90,
      bestReps: 4,
      bestVolume: 2160,
      achievedAt: new Date('2026-08-20T10:00:00.000Z'),
      previousOneRm: null,
    },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SavePersonalRecordsUseCase,
        { provide: STATS_REPOSITORY, useValue: mockRepository },
      ],
    }).compile();

    useCase = module.get<SavePersonalRecordsUseCase>(SavePersonalRecordsUseCase);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('maps input entries to PersonalRecordEntryDomain and delegates to the repository', async () => {
    const expectedDomain = new UserPersonalRecordDomain(
      null,
      userId,
      computedAt,
      recordsInput.map(
        (r) =>
          new PersonalRecordEntryDomain(
            r.exerciseId,
            r.exerciseName,
            r.category,
            r.oneRmEstimated,
            r.bestWeight,
            r.bestReps,
            r.bestVolume,
            r.achievedAt,
            r.previousOneRm,
          ),
      ),
    );
    mockRepository.upsertPersonalRecords.mockResolvedValue(expectedDomain);

    const result = await useCase.execute(userId, recordsInput, computedAt);

    expect(mockRepository.upsertPersonalRecords).toHaveBeenCalledTimes(1);
    const [calledUserId, calledDomain] =
      mockRepository.upsertPersonalRecords.mock.calls[0];

    expect(calledUserId).toBe(userId);
    expect(calledDomain).toBeInstanceOf(UserPersonalRecordDomain);
    expect(calledDomain).toEqual(expectedDomain);
    expect(result).toEqual(expectedDomain);
  });

  it('maps each entry field in order', async () => {
    mockRepository.upsertPersonalRecords.mockResolvedValue(null);

    await useCase.execute(userId, [recordsInput[0]], computedAt);

    const [, calledDomain] = mockRepository.upsertPersonalRecords.mock.calls[0];
    const entry = calledDomain.records[0];

    expect(entry).toBeInstanceOf(PersonalRecordEntryDomain);
    expect(entry.exerciseId).toBe('507f1f77bcf86cd799439041');
    expect(entry.exerciseName).toBe('Squat');
    expect(entry.category).toBe('legs');
    expect(entry.oneRmEstimated).toBe(140);
    expect(entry.bestWeight).toBe(120);
    expect(entry.bestReps).toBe(5);
    expect(entry.bestVolume).toBe(3000);
    expect(entry.achievedAt).toBe(recordsInput[0].achievedAt);
    expect(entry.previousOneRm).toBe(135);
    expect(calledDomain.computedAt).toBe(computedAt);
    expect(calledDomain.userId).toBe(userId);
  });

  it('keeps previousOneRm null when no previous record exists', async () => {
    mockRepository.upsertPersonalRecords.mockResolvedValue(null);

    await useCase.execute(userId, [recordsInput[1]], computedAt);

    const [, calledDomain] = mockRepository.upsertPersonalRecords.mock.calls[0];
    expect(calledDomain.records[0].previousOneRm).toBeNull();
  });

  it('maps an empty records array', async () => {
    const emptyDomain = new UserPersonalRecordDomain(null, userId, computedAt, []);
    mockRepository.upsertPersonalRecords.mockResolvedValue(emptyDomain);

    await useCase.execute(userId, [], computedAt);

    expect(mockRepository.upsertPersonalRecords).toHaveBeenCalledTimes(1);
    const [, calledDomain] = mockRepository.upsertPersonalRecords.mock.calls[0];
    expect(calledDomain.records).toEqual([]);
  });
});