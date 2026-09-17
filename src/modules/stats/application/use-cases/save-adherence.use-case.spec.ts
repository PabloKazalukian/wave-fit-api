import { Test, TestingModule } from '@nestjs/testing';
import { SaveAdherenceUseCase } from './save-adherence.use-case';
import { STATS_REPOSITORY } from '../../domain/interfaces/repositories/stats.repository.interface';
import {
  UserAdherenceDomain,
  AdherenceWeekDomain,
} from '../../domain/entities/stats.domain';

describe('SaveAdherenceUseCase', () => {
  let useCase: SaveAdherenceUseCase;

  const mockRepository = {
    upsertAdherence: jest.fn(),
  };

  const userId = '507f1f77bcf86cd799439011';
  const computedAt = new Date('2026-09-01T12:00:00.000Z');

  const weeksInput = [
    {
      weekStartDate: new Date('2026-08-10T00:00:00.000Z'),
      totalDays: 7,
      completedDays: 5,
      skippedDays: 1,
      pendingDays: 1,
      adherencePercent: 71.43,
    },
    {
      weekStartDate: new Date('2026-08-17T00:00:00.000Z'),
      totalDays: 7,
      completedDays: 6,
      skippedDays: 1,
      pendingDays: 0,
      adherencePercent: 85.71,
    },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaveAdherenceUseCase,
        { provide: STATS_REPOSITORY, useValue: mockRepository },
      ],
    }).compile();

    useCase = module.get<SaveAdherenceUseCase>(SaveAdherenceUseCase);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('maps input entries to AdherenceWeekDomain and delegates to the repository', async () => {
    const expectedDomain = new UserAdherenceDomain(
      null,
      userId,
      computedAt,
      weeksInput.map(
        (w) =>
          new AdherenceWeekDomain(
            w.weekStartDate,
            w.totalDays,
            w.completedDays,
            w.skippedDays,
            w.pendingDays,
            w.adherencePercent,
          ),
      ),
    );
    mockRepository.upsertAdherence.mockResolvedValue(expectedDomain);

    const result = await useCase.execute(userId, weeksInput, computedAt);

    expect(mockRepository.upsertAdherence).toHaveBeenCalledTimes(1);
    const [calledUserId, calledDomain] =
      mockRepository.upsertAdherence.mock.calls[0];

    expect(calledUserId).toBe(userId);
    expect(calledDomain).toBeInstanceOf(UserAdherenceDomain);
    expect(calledDomain).toEqual(expectedDomain);
    expect(result).toEqual(expectedDomain);
  });

  it('maps each entry field in order', async () => {
    mockRepository.upsertAdherence.mockResolvedValue(null);

    await useCase.execute(userId, [weeksInput[0]], computedAt);

    const [, calledDomain] = mockRepository.upsertAdherence.mock.calls[0];
    const entry = calledDomain.weeks[0];

    expect(entry).toBeInstanceOf(AdherenceWeekDomain);
    expect(entry.weekStartDate).toBe(weeksInput[0].weekStartDate);
    expect(entry.totalDays).toBe(7);
    expect(entry.completedDays).toBe(5);
    expect(entry.skippedDays).toBe(1);
    expect(entry.pendingDays).toBe(1);
    expect(entry.adherencePercent).toBe(71.43);
    expect(calledDomain.computedAt).toBe(computedAt);
    expect(calledDomain.userId).toBe(userId);
  });

  it('maps an empty weeks array', async () => {
    const emptyDomain = new UserAdherenceDomain(null, userId, computedAt, []);
    mockRepository.upsertAdherence.mockResolvedValue(emptyDomain);

    await useCase.execute(userId, [], computedAt);

    expect(mockRepository.upsertAdherence).toHaveBeenCalledTimes(1);
    const [, calledDomain] = mockRepository.upsertAdherence.mock.calls[0];
    expect(calledDomain.weeks).toEqual([]);
  });
});