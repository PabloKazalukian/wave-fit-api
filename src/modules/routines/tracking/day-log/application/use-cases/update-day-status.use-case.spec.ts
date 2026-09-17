import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UpdateDayStatusUseCase } from './update-day-status.use-case';
import { DAY_LOG_REPOSITORY } from '../../domain/interfaces/repositories/day-log.repository.interface';
import { WorkoutSessionService } from '../../../workout-session/workout-session.service';
import { DayLogDomain } from '../../domain/entities/day-log.domain';

describe('UpdateDayStatusUseCase', () => {
  let useCase: UpdateDayStatusUseCase;

  const mockRepository = {
    findActive: jest.fn(),
    findOne: jest.fn(),
    updateStatus: jest.fn(),
  };

  const mockWorkoutSessionService = {
    remove: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const mockUserId = '507f1f77bcf86cd799439011';
  const dayLogId = '507f1f77bcf86cd799439012';
  const existingWsId = '507f1f77bcf86cd799439013';
  const newWsId = '507f1f77bcf86cd799439014';

  function makeDayLog(workoutSessionId: string | null) {
    return new DayLogDomain(
      dayLogId,
      mockUserId,
      new Date('2024-01-01T03:00:00.000Z'),
      null,
      null,
      workoutSessionId,
      [],
      'pending',
      true,
      false,
      '',
    );
  }

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateDayStatusUseCase,
        { provide: DAY_LOG_REPOSITORY, useValue: mockRepository },
        {
          provide: WorkoutSessionService,
          useValue: mockWorkoutSessionService,
        },
      ],
    }).compile();

    useCase = module.get<UpdateDayStatusUseCase>(UpdateDayStatusUseCase);
  });

  it('should reject an invalid date', async () => {
    await expect(
      useCase.execute('2025-02-31', false, mockUserId),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should throw NotFoundException when there is no active day-log', async () => {
    mockRepository.findActive.mockResolvedValue(null);

    await expect(
      useCase.execute('2024-01-01', false, mockUserId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should mark as rest without closing the day-log (active untouched, completed=false)', async () => {
    const dayLog = makeDayLog(existingWsId);
    mockRepository.findActive.mockResolvedValue(dayLog);
    mockRepository.findOne.mockResolvedValue(dayLog);

    await useCase.execute('2024-01-01', true, mockUserId);

    expect(mockWorkoutSessionService.remove).toHaveBeenCalledWith(
      existingWsId,
      mockUserId,
    );
    expect(dayLog.status).toBe('skipped');
    expect(dayLog.completed).toBe(false);
    expect(dayLog.active).toBe(true);
    expect(mockRepository.updateStatus).toHaveBeenCalledWith(
      dayLogId,
      'skipped',
      null,
      false,
    );
  });

  it('should go back to pending, force completed=false and create a WS when none exists', async () => {
    const dayLog = makeDayLog(null);
    mockRepository.findActive.mockResolvedValue(dayLog);
    mockWorkoutSessionService.create.mockResolvedValue({ _id: newWsId });
    mockRepository.findOne.mockResolvedValue(dayLog);

    await useCase.execute('2024-01-01', false, mockUserId);

    expect(mockWorkoutSessionService.create).toHaveBeenCalledWith(
      expect.objectContaining({ dayLogId, date: '2024-01-01' }),
      mockUserId,
    );
    expect(dayLog.status).toBe('pending');
    expect(dayLog.completed).toBe(false);
    expect(mockRepository.updateStatus).toHaveBeenCalledWith(
      dayLogId,
      'pending',
      newWsId,
      false,
    );
  });

  it('should reset an existing WS to not_started when going back to pending', async () => {
    const dayLog = makeDayLog(existingWsId);
    mockRepository.findActive.mockResolvedValue(dayLog);
    mockRepository.findOne.mockResolvedValue(dayLog);

    await useCase.execute('2024-01-01', false, mockUserId);

    expect(mockWorkoutSessionService.create).not.toHaveBeenCalled();
    expect(mockWorkoutSessionService.update).toHaveBeenCalledWith(
      existingWsId,
      expect.objectContaining({ status: 'not_started' }),
      mockUserId,
    );
    expect(mockRepository.updateStatus).toHaveBeenCalledWith(
      dayLogId,
      'pending',
      existingWsId,
      false,
    );
  });
});
