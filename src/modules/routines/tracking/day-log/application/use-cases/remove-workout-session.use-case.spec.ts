import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RemoveWorkoutSessionUseCase } from './remove-workout-session.use-case';
import { DAY_LOG_REPOSITORY } from '../../domain/interfaces/repositories/day-log.repository.interface';
import { WorkoutSessionService } from '../../../workout-session/workout-session.service';
import { DayLogDomain } from '../../domain/entities/day-log.domain';

describe('RemoveWorkoutSessionUseCase', () => {
  let useCase: RemoveWorkoutSessionUseCase;

  const mockRepository = {
    findActive: jest.fn(),
    findOne: jest.fn(),
    updateStatus: jest.fn(),
  };

  const mockWorkoutSessionService = {
    remove: jest.fn(),
  };

  const mockUserId = '507f1f77bcf86cd799439011';
  const dayLogId = '507f1f77bcf86cd799439012';
  const wsId = '507f1f77bcf86cd799439013';

  function makeDayLog(workoutSessionId: string | null) {
    return new DayLogDomain(
      dayLogId,
      mockUserId,
      new Date('2024-01-01T03:00:00.000Z'),
      null,
      null,
      workoutSessionId,
      [],
      'complete',
      false,
      true,
      '',
    );
  }

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemoveWorkoutSessionUseCase,
        { provide: DAY_LOG_REPOSITORY, useValue: mockRepository },
        {
          provide: WorkoutSessionService,
          useValue: mockWorkoutSessionService,
        },
      ],
    }).compile();

    useCase = module.get<RemoveWorkoutSessionUseCase>(
      RemoveWorkoutSessionUseCase,
    );
  });

  it('should throw NotFoundException when there is no active day-log', async () => {
    mockRepository.findActive.mockResolvedValue(null);

    await expect(useCase.execute(wsId, mockUserId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('should detach the session, set pending and force completed=false', async () => {
    const dayLog = makeDayLog(wsId);
    mockRepository.findActive.mockResolvedValue(dayLog);
    mockRepository.findOne.mockResolvedValue(dayLog);

    await useCase.execute(wsId, mockUserId);

    expect(mockWorkoutSessionService.remove).toHaveBeenCalledWith(
      wsId,
      mockUserId,
    );
    expect(dayLog.workoutSessionId).toBeNull();
    expect(dayLog.status).toBe('pending');
    expect(dayLog.completed).toBe(false);
    expect(mockRepository.updateStatus).toHaveBeenCalledWith(
      dayLogId,
      'pending',
      null,
      false,
    );
  });
});
