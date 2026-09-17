import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UpdateDayLogUseCase } from './update-day-log.use-case';
import { DAY_LOG_REPOSITORY } from '../../domain/interfaces/repositories/day-log.repository.interface';
import { DayLogValidator } from '../validators/day-log.validator';
import { ExtraSessionService } from '../../../extra-session/extra-session.service';
import { WorkoutSessionService } from '../../../workout-session/workout-session.service';
import { DayLogDomain } from '../../domain/entities/day-log.domain';

describe('UpdateDayLogUseCase', () => {
  let useCase: UpdateDayLogUseCase;

  const mockRepository = {
    findOne: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  };

  const mockValidator = {
    validateOwnership: jest.fn(),
  };

  const mockExtraSessionService = {
    create: jest.fn(),
  };

  const mockWorkoutSessionService = {
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockUserId = '507f1f77bcf86cd799439011';
  const dayLogId = '507f1f77bcf86cd799439012';
  const existingWsId = '507f1f77bcf86cd799439013';
  const newWsId = '507f1f77bcf86cd799439014';
  const extraSessionId = '507f1f77bcf86cd799439015';

  function makeDayLog(workoutSessionId: string | null, extraIds: string[] = []) {
    return new DayLogDomain(
      dayLogId,
      mockUserId,
      new Date('2024-01-01T03:00:00.000Z'),
      null,
      null,
      workoutSessionId,
      extraIds,
      'pending',
      true,
      false,
      '',
    );
  }

  const baseInput = {
    id: dayLogId,
    notes: 'great session',
    completed: true,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateDayLogUseCase,
        { provide: DAY_LOG_REPOSITORY, useValue: mockRepository },
        { provide: DayLogValidator, useValue: mockValidator },
        { provide: ExtraSessionService, useValue: mockExtraSessionService },
        {
          provide: WorkoutSessionService,
          useValue: mockWorkoutSessionService,
        },
      ],
    }).compile();

    useCase = module.get<UpdateDayLogUseCase>(UpdateDayLogUseCase);
  });

  it('should throw NotFoundException if day log does not exist', async () => {
    mockRepository.findOne.mockResolvedValue(null);

    await expect(useCase.execute(baseInput, mockUserId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(useCase.execute(baseInput, mockUserId)).rejects.toThrow(
      'no encontrado',
    );
  });

  it('should update notes/completed without extra session logic', async () => {
    const dayLog = makeDayLog(existingWsId);
    mockRepository.findOne.mockResolvedValue(dayLog);
    mockRepository.findByIdAndUpdate.mockResolvedValue(dayLog);

    await useCase.execute(baseInput, mockUserId);

    expect(mockExtraSessionService.create).not.toHaveBeenCalled();
    expect(mockRepository.findByIdAndUpdate).toHaveBeenCalledWith(
      dayLogId,
      expect.objectContaining({
        notes: 'great session',
        completed: true,
        active: false,
      }),
      expect.objectContaining({ new: true }),
    );
  });

  it('should finalize the day (completed=true → active=false) and auto-create an empty WS when completing without a session', async () => {
    const dayLog = makeDayLog(null);
    mockRepository.findOne.mockResolvedValue(dayLog);
    mockWorkoutSessionService.create.mockResolvedValue({ _id: newWsId });
    mockRepository.findByIdAndUpdate.mockResolvedValue(dayLog);

    await useCase.execute(
      { id: dayLogId, completed: true },
      mockUserId,
    );

    expect(mockWorkoutSessionService.create).toHaveBeenCalledWith(
      expect.objectContaining({ dayLogId, exercises: [] }),
      mockUserId,
    );
    expect(mockRepository.findByIdAndUpdate).toHaveBeenCalledWith(
      dayLogId,
      expect.objectContaining({
        completed: true,
        active: false,
        workoutSessionId: expect.any(Object),
      }),
      expect.anything(),
    );
  });

  it('should create the WorkoutSession from the workoutSession block when none exists', async () => {
    const dayLog = makeDayLog(null);
    mockRepository.findOne.mockResolvedValue(dayLog);
    mockWorkoutSessionService.create.mockResolvedValue({ _id: newWsId });
    mockRepository.findByIdAndUpdate.mockResolvedValue(dayLog);

    await useCase.execute(
      {
        id: dayLogId,
        workoutSession: {
          exercises: [
            { exerciseId: '507f1f77bcf86cd799439099', series: 3, sets: [] },
          ],
        },
      } as any,
      mockUserId,
    );

    expect(mockWorkoutSessionService.create).toHaveBeenCalledWith(
      expect.objectContaining({ dayLogId, exercises: expect.any(Array) }),
      mockUserId,
    );
    expect(mockRepository.findByIdAndUpdate).toHaveBeenCalledWith(
      dayLogId,
      expect.objectContaining({
        workoutSessionId: expect.any(Object),
      }),
      expect.anything(),
    );
  });

  it('should update the existing WorkoutSession from the workoutSession block', async () => {
    const dayLog = makeDayLog(existingWsId);
    mockRepository.findOne.mockResolvedValue(dayLog);
    mockWorkoutSessionService.update.mockResolvedValue({ _id: existingWsId });
    mockRepository.findByIdAndUpdate.mockResolvedValue(dayLog);

    await useCase.execute(
      {
        id: dayLogId,
        workoutSession: { status: 'complete', notes: 'done' },
      } as any,
      mockUserId,
    );

    expect(mockWorkoutSessionService.create).not.toHaveBeenCalled();
    expect(mockWorkoutSessionService.update).toHaveBeenCalledWith(
      existingWsId,
      expect.objectContaining({ status: 'complete' }),
      mockUserId,
    );
  });

  it('should reject a workoutSession.id that does not match the linked session', async () => {
    const dayLog = makeDayLog(existingWsId);
    mockRepository.findOne.mockResolvedValue(dayLog);

    await expect(
      useCase.execute(
        {
          id: dayLogId,
          workoutSession: { id: newWsId, notes: 'x' },
        } as any,
        mockUserId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reuse dayLog.workoutSessionId when present', async () => {
    const dayLog = makeDayLog(existingWsId);
    mockRepository.findOne.mockResolvedValue(dayLog);
    mockExtraSessionService.create.mockResolvedValue({ _id: extraSessionId });
    mockRepository.findByIdAndUpdate.mockResolvedValue(dayLog);

    const result = await useCase.execute(
      {
        id: dayLogId,
        extraSession: {
          date: '2024-01-01',
          discipline: 'running',
          duration: 30,
          intensityLevel: 3,
        },
      },
      mockUserId,
    );

    expect(mockWorkoutSessionService.findOne).not.toHaveBeenCalled();
    expect(mockWorkoutSessionService.create).not.toHaveBeenCalled();
    expect(mockExtraSessionService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workoutSessionId: existingWsId,
        discipline: 'running',
      }),
      mockUserId,
    );
    expect(mockRepository.findByIdAndUpdate).toHaveBeenCalledWith(
      dayLogId,
      expect.objectContaining({ extraSessionIds: [expect.any(Object)] }),
      expect.anything(),
    );
    expect(result).toBeDefined();
  });

  it('should honor an explicit workoutSessionId when the day has none', async () => {
    const dayLog = makeDayLog(null);
    mockRepository.findOne.mockResolvedValue(dayLog);
    mockWorkoutSessionService.findOne.mockResolvedValue({ _id: newWsId });
    mockExtraSessionService.create.mockResolvedValue({ _id: extraSessionId });
    mockRepository.findByIdAndUpdate.mockResolvedValue(dayLog);

    await useCase.execute(
      {
        id: dayLogId,
        workoutSessionId: newWsId,
        extraSession: {
          date: '2024-01-01',
          discipline: 'cycling',
          duration: 45,
          intensityLevel: 4,
        },
      },
      mockUserId,
    );

    expect(mockWorkoutSessionService.findOne).toHaveBeenCalledWith(
      newWsId,
      mockUserId,
    );
    expect(mockExtraSessionService.create).toHaveBeenCalledWith(
      expect.objectContaining({ workoutSessionId: newWsId }),
      mockUserId,
    );
    expect(mockRepository.findByIdAndUpdate).toHaveBeenCalledWith(
      dayLogId,
      expect.objectContaining({ workoutSessionId: expect.any(Object) }),
      expect.anything(),
    );
  });

  it('should reject a workoutSessionId that does not belong to the user', async () => {
    const dayLog = makeDayLog(null);
    mockRepository.findOne.mockResolvedValue(dayLog);
    mockWorkoutSessionService.findOne.mockResolvedValue(null);

    await expect(
      useCase.execute(
        {
          id: dayLogId,
          workoutSessionId: newWsId,
          extraSession: {
            date: '2024-01-01',
            discipline: 'yoga',
            duration: 60,
            intensityLevel: 2,
          },
        },
        mockUserId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should create an empty workout session when none exists', async () => {
    const dayLog = makeDayLog(null);
    mockRepository.findOne.mockResolvedValue(dayLog);
    mockWorkoutSessionService.create.mockResolvedValue({ _id: newWsId });
    mockExtraSessionService.create.mockResolvedValue({ _id: extraSessionId });
    mockRepository.findByIdAndUpdate.mockResolvedValue(dayLog);

    await useCase.execute(
      {
        id: dayLogId,
        extraSession: {
          date: '2024-01-01',
          discipline: 'swimming',
          duration: 30,
          intensityLevel: 3,
        },
      },
      mockUserId,
    );

    expect(mockWorkoutSessionService.create).toHaveBeenCalled();
    expect(mockExtraSessionService.create).toHaveBeenCalledWith(
      expect.objectContaining({ workoutSessionId: newWsId }),
      mockUserId,
    );
    expect(mockRepository.findByIdAndUpdate).toHaveBeenCalledWith(
      dayLogId,
      expect.objectContaining({
        workoutSessionId: expect.any(Object),
        extraSessionIds: expect.any(Array),
      }),
      expect.anything(),
    );
  });

  it('should persist status="complete" verbatim without touching completed/active/WS', async () => {
    const dayLog = makeDayLog(existingWsId);
    mockRepository.findOne.mockResolvedValue(dayLog);
    mockRepository.findByIdAndUpdate.mockResolvedValue(dayLog);

    await useCase.execute({ id: dayLogId, status: 'complete' } as any, mockUserId);

    expect(mockWorkoutSessionService.create).not.toHaveBeenCalled();
    expect(mockWorkoutSessionService.remove).not.toHaveBeenCalled();
    expect(mockRepository.findByIdAndUpdate).toHaveBeenCalledWith(
      dayLogId,
      { status: 'complete' },
      expect.anything(),
    );
  });

  it('should persist status="skipped" verbatim without removing the WS or changing completed', async () => {
    const dayLog = makeDayLog(existingWsId);
    mockRepository.findOne.mockResolvedValue(dayLog);
    mockRepository.findByIdAndUpdate.mockResolvedValue(dayLog);

    await useCase.execute({ id: dayLogId, status: 'skipped' } as any, mockUserId);

    expect(mockWorkoutSessionService.remove).not.toHaveBeenCalled();
    expect(mockRepository.findByIdAndUpdate).toHaveBeenCalledWith(
      dayLogId,
      { status: 'skipped' },
      expect.anything(),
    );
  });

  it('should persist status="pending" verbatim', async () => {
    const dayLog = makeDayLog(existingWsId);
    mockRepository.findOne.mockResolvedValue(dayLog);
    mockRepository.findByIdAndUpdate.mockResolvedValue(dayLog);

    await useCase.execute({ id: dayLogId, status: 'pending' } as any, mockUserId);

    expect(mockRepository.findByIdAndUpdate).toHaveBeenCalledWith(
      dayLogId,
      { status: 'pending' },
      expect.anything(),
    );
  });

  it('should not infer status when only completed=true is sent', async () => {
    const dayLog = makeDayLog(existingWsId);
    mockRepository.findOne.mockResolvedValue(dayLog);
    mockRepository.findByIdAndUpdate.mockResolvedValue(dayLog);

    await useCase.execute({ id: dayLogId, completed: true } as any, mockUserId);

    expect(mockRepository.findByIdAndUpdate).toHaveBeenCalledWith(
      dayLogId,
      expect.not.objectContaining({ status: expect.anything() }),
      expect.anything(),
    );
  });
});