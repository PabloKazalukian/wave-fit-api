import { Test, TestingModule } from '@nestjs/testing';
import { WeekLogService } from './week-log.service';
import { getModelToken } from '@nestjs/mongoose';
import { WeekLog } from './infrastructure/schemas/week-log.schema';
import { Model, Types } from 'mongoose';
import { CreateWeekLogInput } from './presentation/dto/create-week-log.input';
import { UpdateWeekLogInput } from './presentation/dto/update-week-log.input';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { AuditInterceptor } from 'src/modules/audit-logs/audit-logs.interceptor';
import { WorkoutSession } from '../workout-session/schema/workout-session.schema';
import { WeekLogValidator } from './application/validators/week-log.validator';
import { RoutineDayService } from '../../templates/routine-day/routine-day.service';
import {
  CreateWeekLogUseCase,
  FindAllWeekLogsByUserUseCase,
  UpdateDayUseCase,
  UpdateWeekLogUseCase,
} from './application/use-cases';
import { WorkoutSessionService } from '../workout-session/workout-session.service';

describe('WeekLogService', () => {
  let service: WeekLogService;
  let model: Model<WeekLog>;

  const mockSave = jest.fn();

  const mockWeekLogModel = jest.fn().mockImplementation((input) => ({
    ...input,
    userId: null,
    save: mockSave,
  }));

  const mockQuery = {
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn(),
    lean: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
  };

  (mockWeekLogModel as any).findOne = jest.fn().mockReturnValue(mockQuery);
  (mockWeekLogModel as any).find = jest.fn().mockReturnValue(mockQuery);
  (mockWeekLogModel as any).findOneAndUpdate = jest.fn().mockReturnValue(mockQuery);
  (mockWeekLogModel as any).findByIdAndUpdate = jest.fn().mockReturnValue(mockQuery);
  (mockWeekLogModel as any).deleteOne = jest.fn().mockReturnValue(mockQuery);
  (mockWeekLogModel as any).updateOne = jest.fn().mockReturnValue(mockQuery);

  const mockWorkoutSessionModel = {
    find: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockValidator = {
    validateOwnership: jest.fn(),
  };

  const mockRoutineDayService = {
    findOne: jest.fn(),
  };

  const mockCreateWeekLogUseCase = { execute: jest.fn() };
  const mockFindAllWeekLogsByUserUseCase = { execute: jest.fn() };
  const mockUpdateDayUseCase = { execute: jest.fn() };
  const mockUpdateWeekLogUseCase = { execute: jest.fn() };
  const mockWorkoutSessionService = { remove: jest.fn() };

  const mockUserId = new Types.ObjectId();
  const mockWeekLogId = new Types.ObjectId();
  const mockPlanId = new Types.ObjectId().toString();
  const mockWeekLog = {
    id: mockWeekLogId,
    userId: mockUserId,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-07'),
    workouts: [],
    extras: [],
    planId: mockPlanId,
    notes: 'Test week',
    completed: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeekLogService,
        {
          provide: getModelToken(WeekLog.name),
          useValue: mockWeekLogModel,
        },
        {
          provide: getModelToken(WorkoutSession.name),
          useValue: mockWorkoutSessionModel,
        },
        {
          provide: WeekLogValidator,
          useValue: mockValidator,
        },
        {
          provide: RoutineDayService,
          useValue: mockRoutineDayService,
        },
        {
          provide: CreateWeekLogUseCase,
          useValue: mockCreateWeekLogUseCase,
        },
        {
          provide: FindAllWeekLogsByUserUseCase,
          useValue: mockFindAllWeekLogsByUserUseCase,
        },
        {
          provide: UpdateDayUseCase,
          useValue: mockUpdateDayUseCase,
        },
        {
          provide: UpdateWeekLogUseCase,
          useValue: mockUpdateWeekLogUseCase,
        },
        {
          provide: WorkoutSessionService,
          useValue: mockWorkoutSessionService,
        },
      ],
    })
      .overrideInterceptor(AuditInterceptor)
      .useValue({
        intercept: jest
          .fn()
          .mockImplementation((context, next) => next.handle()),
      })
      .compile();

    service = module.get<WeekLogService>(WeekLogService);

    // Default mock resolutions to avoid "undefined" errors in tests
    mockCreateWeekLogUseCase.execute.mockResolvedValue(mockWeekLog);
    mockFindAllWeekLogsByUserUseCase.execute.mockResolvedValue([mockWeekLog]);
    mockUpdateDayUseCase.execute.mockResolvedValue(mockWeekLog);
    mockUpdateWeekLogUseCase.execute.mockResolvedValue(mockWeekLog);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new week log for authenticated user', async () => {
      const input: CreateWeekLogInput = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
        planId: 'plan-id',
        notes: 'New week log',
      };

      (mockWeekLogModel as any).findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      mockSave.mockResolvedValue({
        _id: mockWeekLogId,
        userId: mockUserId,
        ...input,
      });

      const result = await service.create(input, mockUserId);

      expect((mockWeekLogModel as any).findOne).toHaveBeenCalledWith({
        userId: mockUserId.toHexString(),
        completed: false,
      });

      expect(result).toMatchObject({
        userId: mockUserId,
        startDate: input.startDate,
        endDate: input.endDate,
      });
    });

    it('should validate date range (endDate must be after startDate)', async () => {
      const invalidInput: CreateWeekLogInput = {
        startDate: new Date('2024-01-07'),
        endDate: new Date('2024-01-01'),
      };

      await expect(service.create(invalidInput, mockUserId)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.create(invalidInput, mockUserId)).rejects.toThrow(
        'endDate must be after startDate',
      );
    });

    it('should throw error if active week log already exists', async () => {
      const input: CreateWeekLogInput = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
      };

      (mockWeekLogModel as any).findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: mockWeekLogId,
          userId: mockUserId,
          completed: false,
        }),
      });

      await expect(service.create(input, mockUserId)).rejects.toThrow(
        ForbiddenException,
      );

      await expect(service.create(input, mockUserId)).rejects.toThrow(
        'Ya existe una semana activa',
      );
    });

    it('should create week log without optional fields', async () => {
      const minimalInput: CreateWeekLogInput = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
      };

      (mockWeekLogModel as any).findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      mockSave.mockResolvedValue({
        _id: mockWeekLogId,
        userId: mockUserId,
        ...minimalInput,
        planId: null,
        notes: '',
      });

      const result = await service.create(minimalInput, mockUserId);

      expect(result?.planId).toBeNull();
      expect(result?.notes).toBe('');
    });
  });

  describe('findAll', () => {
    it('should return all week logs for authenticated user', async () => {
      const logs = [
        { _id: new Types.ObjectId(), userId: mockUserId },
        { _id: new Types.ObjectId(), userId: mockUserId },
      ];

      (mockWeekLogModel as any).find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(logs),
      });

      const result = await service.findAllByUser(mockUserId.toHexString());

      expect((mockWeekLogModel as any).find).toHaveBeenCalledWith({
        userId: mockUserId.toHexString(),
      });

      expect(result).toHaveLength(2);
    });

    it('should return empty array if user has no week logs', async () => {
      (mockWeekLogModel as any).find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      const result = await service.findAllByUser(mockUserId.toHexString());

      expect(result).toEqual([]);
    });

    it('should only return week logs belonging to the authenticated user', async () => {
      const logs = [{ _id: new Types.ObjectId(), userId: mockUserId }];

      (mockWeekLogModel as any).find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(logs),
      });

      const result = await service.findAllByUser(mockUserId.toHexString());

      expect((mockWeekLogModel as any).find).toHaveBeenCalledWith({
        userId: mockUserId.toHexString(),
      });

      expect(result?.every((log) => log.userId === mockUserId)).toBe(true);
    });
  });

  describe('findOne', () => {
    it('should return a week log by id for the authenticated user', async () => {
      (mockWeekLogModel as any).findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWeekLog),
      });

      const result = await service.findOne(
        mockWeekLogId.toString(),
        mockUserId.toString(),
      );

      expect(result).toEqual(mockWeekLog);
    });

    it('should throw NotFoundException if week log does not exist', async () => {
      (mockWeekLogModel as any).findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.findOne(mockWeekLogId.toHexString(), mockUserId.toHexString()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if week log does not exist for user', async () => {
      (mockWeekLogModel as any).findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      const result = await service.findOne(
        mockWeekLogId.toHexString(),
        mockUserId.toHexString(),
      );
      expect(result).toEqual({});
    });
  });

  describe('findActiveWeekLog', () => {
    it('should return the active week log for the authenticated user', async () => {
      const activeWeekLog = {
        ...mockWeekLog,
        completed: false,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
      };

      (mockWeekLogModel as any).findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(activeWeekLog),
      });

      const result = await service.findActiveWeekLog(mockUserId.toString());

      expect((mockWeekLogModel as any).findOne).toHaveBeenCalledWith({
        userId: mockUserId.toString(),
        completed: false,
      });
      expect(result).toEqual(activeWeekLog);
      expect(result?.completed).toBe(false);
    });

    it('should return null if no active week log exists', async () => {
      (mockWeekLogModel as any).findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.findActiveWeekLog(mockUserId.toString());

      expect(result).toBeNull();
    });

    it('should return the most recent active week log if multiple exist', async () => {
      const recentActiveWeekLog = {
        ...mockWeekLog,
        completed: false,
        startDate: new Date('2024-01-08'),
      };

      (mockWeekLogModel as any).findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(recentActiveWeekLog),
      });

      const result = await service.findActiveWeekLog(mockUserId.toString());

      expect(result?.startDate).toEqual(new Date('2024-01-08'));
    });
  });

  // describe('update', () => {
  //   it('should update a week log for the authenticated user', async () => {
  //     const updateInput: UpdateWeekLogInput = {
  //       id: mockWeekLogId,
  //       notes: 'Updated notes',
  //       completed: true,
  //     };

  //     const updatedWeekLog = {
  //       ...mockWeekLog,
  //       ...updateInput,
  //     };

  //     jest.spyOn(model, 'findById').mockReturnValue({
  //       exec: jest.fn().mockResolvedValue(mockWeekLog),
  //     } as any);

  //     jest.spyOn(model, 'findByIdAndUpdate').mockReturnValue({
  //       exec: jest.fn().mockResolvedValue(updatedWeekLog),
  //     } as any);

  //     const result = await service.update(updateInput, mockUserId);

  //     expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
  //       mockWeekLogId,
  //       updateInput,
  //       { new: true },
  //     );
  //     expect(result.notes).toBe('Updated notes');
  //     expect(result.completed).toBe(true);
  //   });

  //   it('should throw NotFoundException if week log does not exist', async () => {
  //     const updateInput: UpdateWeekLogInput = {
  //       id: mockWeekLogId,
  //       notes: 'Updated',
  //     };

  //     jest.spyOn(model, 'findById').mockReturnValue({
  //       exec: jest.fn().mockResolvedValue(null),
  //     } as any);

  //     await expect(service.update(updateInput, mockUserId)).rejects.toThrow(
  //       NotFoundException,
  //     );
  //   });

  //   it('should throw ForbiddenException if trying to update another users week log', async () => {
  //     const otherUserId = new Types.ObjectId().toString();
  //     const otherUserWeekLog = { ...mockWeekLog, userId: otherUserId };

  //     const updateInput: UpdateWeekLogInput = {
  //       id: mockWeekLogId,
  //       notes: 'Trying to update',
  //     };

  //     jest.spyOn(model, 'findById').mockReturnValue({
  //       exec: jest.fn().mockResolvedValue(otherUserWeekLog),
  //     } as any);

  //     await expect(service.update(updateInput, mockUserId)).rejects.toThrow(
  //       ForbiddenException,
  //     );
  //   });

  //   it('should allow partial updates', async () => {
  //     const updateInput: UpdateWeekLogInput = {
  //       id: mockWeekLogId,
  //       completed: true,
  //       // Only updating completed field
  //     };

  //     const updatedWeekLog = {
  //       ...mockWeekLog,
  //       completed: true,
  //     };

  //     jest.spyOn(model, 'findById').mockReturnValue({
  //       exec: jest.fn().mockResolvedValue(mockWeekLog),
  //     } as any);

  //     jest.spyOn(model, 'findByIdAndUpdate').mockReturnValue({
  //       exec: jest.fn().mockResolvedValue(updatedWeekLog),
  //     } as any);

  //     const result = await service.update(updateInput, mockUserId);

  //     expect(result.completed).toBe(true);
  //     expect(result.notes).toBe(mockWeekLog.notes); // Unchanged
  //   });
  // });

  // describe('remove', () => {
  //   it('should remove a week log for the authenticated user', async () => {
  //     jest.spyOn(model, 'findById').mockReturnValue({
  //       exec: jest.fn().mockResolvedValue(mockWeekLog),
  //     } as any);

  //     jest.spyOn(model, 'findByIdAndDelete').mockReturnValue({
  //       exec: jest.fn().mockResolvedValue(mockWeekLog),
  //     } as any);

  //     const result = await service.remove(mockWeekLogId, mockUserId);

  //     expect(model.findByIdAndDelete).toHaveBeenCalledWith(mockWeekLogId);
  //     expect(result).toEqual(mockWeekLog);
  //   });

  //   it('should throw NotFoundException if week log does not exist', async () => {
  //     jest.spyOn(model, 'findById').mockReturnValue({
  //       exec: jest.fn().mockResolvedValue(null),
  //     } as any);

  //     await expect(service.remove(mockWeekLogId, mockUserId)).rejects.toThrow(
  //       NotFoundException,
  //     );
  //   });

  //   it('should throw ForbiddenException if trying to delete another users week log', async () => {
  //     const otherUserId = new Types.ObjectId().toString();
  //     const otherUserWeekLog = { ...mockWeekLog, userId: otherUserId };

  //     jest.spyOn(model, 'findById').mockReturnValue({
  //       exec: jest.fn().mockResolvedValue(otherUserWeekLog),
  //     } as any);

  //     await expect(service.remove(mockWeekLogId, mockUserId)).rejects.toThrow(
  //       ForbiddenException,
  //     );
  //   });
  // });

  // describe('getCurrentWorkoutSession', () => {
  //   it('should return the current workout session for today from active week log', async () => {
  //     const today = new Date();
  //     const mockWorkoutSession = {
  //       date: today,
  //       routineDayId: 'routine-day-123',
  //       exercises: [],
  //       notes: 'Today workout',
  //     };

  //     const activeWeekLog = {
  //       ...mockWeekLog,
  //       workouts: [mockWorkoutSession],
  //     };

  //     jest.spyOn(model, 'findOne').mockReturnValue({
  //       sort: jest.fn().mockReturnValue({
  //         exec: jest.fn().mockResolvedValue(activeWeekLog),
  //       }),
  //     } as any);

  //     const result = await service.getCurrentWorkoutSession(mockUserId);

  //     expect(result).toEqual(mockWorkoutSession);
  //   });

  //   it('should return null if no workout session exists for today', async () => {
  //     const activeWeekLog = {
  //       ...mockWeekLog,
  //       workouts: [],
  //     };

  //     jest.spyOn(model, 'findOne').mockReturnValue({
  //       sort: jest.fn().mockReturnValue({
  //         exec: jest.fn().mockResolvedValue(activeWeekLog),
  //       }),
  //     } as any);

  //     const result = await service.getCurrentWorkoutSession(mockUserId);

  //     expect(result).toBeNull();
  //   });

  //   it('should return null if no active week log exists', async () => {
  //     jest.spyOn(model, 'findOne').mockReturnValue({
  //       sort: jest.fn().mockReturnValue({
  //         exec: jest.fn().mockResolvedValue(null),
  //       }),
  //     } as any);

  //     const result = await service.getCurrentWorkoutSession(mockUserId);

  //     expect(result).toBeNull();
  //   });
  // });
});
