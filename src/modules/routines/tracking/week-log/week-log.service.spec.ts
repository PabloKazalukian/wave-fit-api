import { Test, TestingModule } from '@nestjs/testing';
import { WeekLogService } from './week-log.service';
import { getModelToken } from '@nestjs/mongoose';
import { WeekLog } from './infrastructure/schemas/week-log.schema';
import { Types } from 'mongoose';
import { CreateWeekLogInput } from './presentation/dto/create-week-log.input';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
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
import { WEEK_LOG_REPOSITORY } from './domain/interfaces/repositories/week-log.repository.interface';

describe('WeekLogService', () => {
  let service: WeekLogService;

  const mockQuery = {
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn(),
    lean: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
  };

  const mockWeekLogModel = {
    findOne: jest.fn().mockReturnValue(mockQuery),
    find: jest.fn().mockReturnValue(mockQuery),
    findOneAndUpdate: jest.fn().mockReturnValue(mockQuery),
    findByIdAndUpdate: jest.fn().mockReturnValue(mockQuery),
    deleteOne: jest.fn().mockReturnValue(mockQuery),
    updateOne: jest.fn().mockReturnValue(mockQuery),
  };

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

  const mockRepository = {
    findOne: jest.fn(),
    findAllByUser: jest.fn(),
    findActive: jest.fn(),
    create: jest.fn(),
  };

  const mockUserId = new Types.ObjectId();
  const mockWeekLogId = new Types.ObjectId();
  const mockPlanId = new Types.ObjectId().toString();

  const mockWeekLog = {
    id: mockWeekLogId.toString(),
    userId: mockUserId.toString(),
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-07'),
    days: [],
    planId: mockPlanId,
    notes: 'Test week',
    active: true,
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
        {
          provide: WEEK_LOG_REPOSITORY,
          useValue: mockRepository,
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new week log for authenticated user', async () => {
      const input: CreateWeekLogInput = {
        startDate: '2024-01-01',
        endDate: '2024-01-07',
        timezone: 'America/Argentina/Buenos_Aires',
        planId: 'plan-id',
        notes: 'New week log',
      };

      mockCreateWeekLogUseCase.execute.mockResolvedValue({
        ...mockWeekLog,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
      });

      const result = await service.create(input, mockUserId);

      expect(mockCreateWeekLogUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: input.startDate,
          endDate: input.endDate,
        }),
        mockUserId.toString(),
      );

      expect(result).toMatchObject({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
      });
    });

    it('should validate date range (endDate must be after startDate)', async () => {
      const invalidInput: CreateWeekLogInput = {
        startDate: '2024-01-07',
        endDate: '2024-01-01',
        timezone: 'America/Argentina/Buenos_Aires',
      };

      mockCreateWeekLogUseCase.execute.mockRejectedValue(
        new ForbiddenException('endDate must be after startDate'),
      );

      await expect(service.create(invalidInput, mockUserId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw error if active week log already exists', async () => {
      const input: CreateWeekLogInput = {
        startDate: '2024-01-01',
        endDate: '2024-01-07',
        timezone: 'America/Argentina/Buenos_Aires',
      };

      mockCreateWeekLogUseCase.execute.mockRejectedValue(
        new ForbiddenException('Ya existe una semana activa'),
      );

      await expect(service.create(input, mockUserId)).rejects.toThrow(
        ForbiddenException,
      );

      await expect(service.create(input, mockUserId)).rejects.toThrow(
        'Ya existe una semana activa',
      );
    });

    it('should create week log without optional fields', async () => {
      const minimalInput: CreateWeekLogInput = {
        startDate: '2024-01-01',
        endDate: '2024-01-07',
        timezone: 'America/Argentina/Buenos_Aires',
      };

      mockCreateWeekLogUseCase.execute.mockResolvedValue({
        ...mockWeekLog,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
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
        { id: new Types.ObjectId().toString(), userId: mockUserId.toString() },
        { id: new Types.ObjectId().toString(), userId: mockUserId.toString() },
      ];

      mockFindAllWeekLogsByUserUseCase.execute.mockResolvedValue(logs);

      const result = await service.findAllByUser(mockUserId.toHexString());

      expect(mockFindAllWeekLogsByUserUseCase.execute).toHaveBeenCalledWith(
        mockUserId.toHexString(),
        5,
        0,
      );

      expect(result).toHaveLength(2);
    });

    it('should return empty array if user has no week logs', async () => {
      mockFindAllWeekLogsByUserUseCase.execute.mockResolvedValue([]);

      const result = await service.findAllByUser(mockUserId.toHexString());

      expect(result).toEqual([]);
    });

    it('should only return week logs belonging to the authenticated user', async () => {
      const logs = [
        { id: new Types.ObjectId().toString(), userId: mockUserId.toString() },
      ];

      mockFindAllWeekLogsByUserUseCase.execute.mockResolvedValue(logs);

      const result = await service.findAllByUser(mockUserId.toHexString());

      expect(result?.every((log) => log.userId === mockUserId.toString())).toBe(
        true,
      );
    });
  });

  describe('findOne', () => {
    it('should return a week log by id for the authenticated user', async () => {
      const mockPopulateQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          toObject: () => ({
            _id: mockWeekLogId,
            userId: mockUserId,
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-01-07'),
            days: [],
            planId: mockPlanId,
            notes: 'Test week',
          }),
        }),
      };
      mockWeekLogModel.findOne.mockReturnValue(mockPopulateQuery);

      const result = await service.findOne(
        mockWeekLogId.toString(),
        mockUserId.toString(),
      );

      expect(mockWeekLogModel.findOne).toHaveBeenCalledWith({
        _id: mockWeekLogId.toString(),
        userId: mockUserId.toString(),
      });
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if week log does not exist', async () => {
      const mockPopulateQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };
      mockWeekLogModel.findOne.mockReturnValue(mockPopulateQuery);

      await expect(
        service.findOne(mockWeekLogId.toHexString(), mockUserId.toHexString()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findActiveWeekLog', () => {
    it('should return the active week log for the authenticated user', async () => {
      const mockPopulateQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          toObject: () => ({
            _id: mockWeekLogId,
            userId: mockUserId,
            active: true,
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-01-07'),
            days: [],
            planId: mockPlanId,
            notes: 'Test week',
          }),
        }),
      };
      mockWeekLogModel.findOne.mockReturnValue(mockPopulateQuery);

      const result = await service.findActiveWeekLog(mockUserId.toString());

      expect(mockWeekLogModel.findOne).toHaveBeenCalledWith({
        userId: mockUserId.toString(),
        active: true,
      });
      expect(result).toBeDefined();
    });

    it('should return null if no active week log exists', async () => {
      const mockPopulateQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };
      mockWeekLogModel.findOne.mockReturnValue(mockPopulateQuery);

      const result = await service.findActiveWeekLog(mockUserId.toString());

      expect(result).toBeNull();
    });

    it('should return the most recent active week log if multiple exist', async () => {
      const mockPopulateQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          toObject: () => ({
            _id: mockWeekLogId,
            userId: mockUserId,
            active: true,
            startDate: new Date('2024-01-08'),
            endDate: new Date('2024-01-14'),
            days: [],
            planId: mockPlanId,
            notes: 'Test week',
          }),
        }),
      };
      mockWeekLogModel.findOne.mockReturnValue(mockPopulateQuery);

      const result = await service.findActiveWeekLog(mockUserId.toString());

      expect(result).toBeDefined();
    });
  });
});
