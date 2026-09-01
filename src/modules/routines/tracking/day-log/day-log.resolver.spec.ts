import { Test, TestingModule } from '@nestjs/testing';
import { DayLogResolver } from './day-log.resolver';
import { DayLogService } from './day-log.service';
import { CreateDayLogInput } from './presentation/dto/create-day-log.input';
import { UpdateDayLogInput } from './presentation/dto/update-day-log.input';
import { Types } from 'mongoose';
import { BadRequestException } from '@nestjs/common';
import { AuditInterceptor } from 'src/modules/audit-logs/audit-logs.interceptor';

describe('DayLogResolver', () => {
  let resolver: DayLogResolver;
  let service: DayLogService;

  const mockUserId = new Types.ObjectId().toString();
  const mockDayLogId = new Types.ObjectId().toString();
  const mockPlanId = new Types.ObjectId().toString();

  const mockDayLog = {
    id: mockDayLogId,
    userId: mockUserId,
    date: new Date('2024-01-01T03:00:00.000Z'),
    planId: mockPlanId,
    routineDayId: null,
    workoutSessionId: null,
    extraSessionIds: [],
    status: 'pending',
    active: true,
    completed: false,
    notes: 'Test day',
  };

  const mockDayLogService = {
    create: jest.fn(),
    findAllByUser: jest.fn(),
    findOne: jest.fn(),
    findActiveDayLog: jest.fn(),
    update: jest.fn(),
    updateDayStatus: jest.fn(),
    assignRoutineToDay: jest.fn(),
    removeWorkoutSessionFromDay: jest.fn(),
    removeExtraSessionFromDay: jest.fn(),
    remove: jest.fn(),
  };

  const mockContext = (userId?: string) => ({
    req: {
      user: userId ? { id: userId } : undefined,
    },
  });

  const validInputtoCreate: CreateDayLogInput = {
    date: '2024-01-01',
    timezone: 'America/Argentina/Buenos_Aires',
    planId: mockPlanId,
    notes: 'New day',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DayLogResolver,
        {
          provide: DayLogService,
          useValue: mockDayLogService,
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

    resolver = module.get<DayLogResolver>(DayLogResolver);
    service = module.get<DayLogService>(DayLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication & Authorization', () => {
    it('should require user to be authenticated for all operations', async () => {
      const metadata = Reflect.getMetadata('__guards__', DayLogResolver);
      expect(metadata).toBeDefined();
    });

    it('should extract user from GraphQL context when using createDayLog', async () => {
      jest.spyOn(service, 'create').mockResolvedValue({} as any);
      await resolver.createDayLog(
        validInputtoCreate,
        mockContext(mockUserId),
      );
      expect(service.create).toHaveBeenCalledWith(
        validInputtoCreate,
        expect.any(String),
      );
    });

    it('should throw BadRequestException if user id is invalid', async () => {
      await expect(
        resolver.createDayLog(
          validInputtoCreate,
          mockContext('invalid-id'),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(service.create).not.toHaveBeenCalled();
    });
  });

  describe('createDayLog', () => {
    it('should create a day log for authenticated user', async () => {
      mockDayLogService.create.mockResolvedValue(mockDayLog);

      const result = await resolver.createDayLog(
        validInputtoCreate,
        mockContext(mockUserId),
      );

      expect(service.create).toHaveBeenCalledWith(
        validInputtoCreate,
        expect.any(String),
      );
      expect(result).toEqual(mockDayLog);
    });
  });

  describe('findAll', () => {
    it('should return all day logs for authenticated user', async () => {
      mockDayLogService.findAllByUser.mockResolvedValue([mockDayLog]);

      const result = await resolver.findAll(
        mockContext(mockUserId),
        5,
        5,
      );

      expect(service.findAllByUser).toHaveBeenCalledWith(mockUserId, 5, 5);
      expect(result).toEqual([mockDayLog]);
    });
  });

  describe('findOne', () => {
    it('should return a day log by id for authenticated user', async () => {
      mockDayLogService.findOne.mockResolvedValue(mockDayLog);

      const result = await resolver.findOne(
        mockDayLogId,
        mockContext(mockUserId),
      );

      expect(service.findOne).toHaveBeenCalledWith(mockDayLogId, mockUserId);
      expect(result).toEqual(mockDayLog);
    });
  });

  describe('findActiveDayLog', () => {
    it('should return the active day log for authenticated user', async () => {
      mockDayLogService.findActiveDayLog.mockResolvedValue(mockDayLog);

      const result = await resolver.findActiveDayLog(
        mockContext(mockUserId),
      );

      expect(service.findActiveDayLog).toHaveBeenCalledWith(mockUserId);
      expect(result.hasActiveDay).toBe(true);
      expect(result.day).toEqual(mockDayLog);
    });

    it('should return hasActiveDay false if no active day log exists', async () => {
      mockDayLogService.findActiveDayLog.mockResolvedValue(null);

      const result = await resolver.findActiveDayLog(
        mockContext(mockUserId),
      );

      expect(result).toEqual({ hasActiveDay: false });
    });
  });

  describe('updateDayLog', () => {
    it('should update a day log for authenticated user', async () => {
      const updateInput: UpdateDayLogInput = {
        id: mockDayLogId,
        notes: 'Updated notes',
        completed: true,
      };

      mockDayLogService.update.mockResolvedValue({
        ...mockDayLog,
        ...updateInput,
      });

      const result = await resolver.updateDayLog(
        updateInput,
        mockContext(mockUserId),
      );

      expect(service.update).toHaveBeenCalledWith(updateInput, mockUserId);
      expect(result?.notes).toBe('Updated notes');
    });
  });

  describe('removeDayLog', () => {
    it('should remove a day log for authenticated user', async () => {
      mockDayLogService.remove.mockResolvedValue(mockDayLog);

      const result = await resolver.removeDayLog(
        mockDayLogId,
        mockContext(mockUserId),
      );

      expect(service.remove).toHaveBeenCalledWith(mockDayLogId, mockUserId);
      expect(result).toEqual(mockDayLog);
    });
  });
});
