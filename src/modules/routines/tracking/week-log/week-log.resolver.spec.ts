import { Test, TestingModule } from '@nestjs/testing';
import { WeekLogResolver } from './week-log.resolver';
import { WeekLogService } from './week-log.service';
import { CreateWeekLogInput } from './dto/create-week-log.input';
import { UpdateWeekLogInput } from './dto/update-week-log.input';
import { Types } from 'mongoose';
import {
  BadRequestException,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

describe('WeekLogResolver', () => {
  let resolver: WeekLogResolver;
  let service: WeekLogService;

  const mockUserId = new Types.ObjectId().toString();
  const mockWeekLogId = new Types.ObjectId().toString();
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

  const mockWeekLogService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findAllByUser: jest.fn(),
    findOne: jest.fn(),
    findActiveWeekLog: jest.fn(),
    // getCurrentWorkoutSession: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  // Mock del contexto GraphQL con usuario autenticado
  const mockGqlExecutionContext = {
    getContext: jest.fn().mockReturnValue({
      req: {
        user: {
          id: mockUserId,
          email: 'test@example.com',
        },
      },
    }),
  };

  const validUserId = new Types.ObjectId().toString();

  const validInputtoCreate = {
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-07'),
  };

  const mockContext = (userId?: string) => ({
    req: {
      user: userId ? { id: userId } : undefined,
    },
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeekLogResolver,
        {
          provide: WeekLogService,
          useValue: mockWeekLogService,
        },
      ],
    }).compile();

    resolver = module.get<WeekLogResolver>(WeekLogResolver);
    service = module.get<WeekLogService>(WeekLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication & Authorization', () => {
    it('should require user to be authenticated for all operations', async () => {
      // Este test verifica que el guard está configurado
      // En la implementación real, el guard debe estar aplicado al resolver
      const metadata = Reflect.getMetadata('__guards__', WeekLogResolver);

      // Verificar que existe un guard configurado
      expect(metadata).toBeDefined();
    });

    it('should extract user from GraphQL context', () => {
      const context = mockGqlExecutionContext.getContext();

      expect(context.req.user).toBeDefined();
      expect(context.req.user.id).toBe(mockUserId);
    });

    it('should extract user from GraphQL context when uses createWeekLog', async () => {
      const input = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
      };

      jest.spyOn(service, 'create').mockResolvedValue({} as any);

      await resolver.createWeekLog(input, mockContext(validUserId));

      expect(service.create).toHaveBeenCalledWith(
        input,
        expect.any(Types.ObjectId),
      );
    });

    it('should throw BadRequestException if user id is invalid', async () => {
      await expect(
        resolver.createWeekLog(validInputtoCreate, mockContext('invalid-id')),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(service.create).not.toHaveBeenCalled();
    });

    it('should convert user id from context to ObjectId and pass it to service', async () => {
      const createInput: CreateWeekLogInput = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
      };

      const context = {
        req: {
          user: {
            id: mockUserId,
          },
        },
      };

      mockWeekLogService.create.mockResolvedValue(mockWeekLog);

      const result = await resolver.createWeekLog(createInput, context as any);

      expect(service.create).toHaveBeenCalledWith(
        createInput,
        expect.any(Types.ObjectId),
      );

      const passedUserId = mockWeekLogService.create.mock.calls[0][1];
      expect(passedUserId.toHexString()).toBe(mockUserId);

      expect(result).toEqual(mockWeekLog);
    });
  });

  describe('createWeekLog', () => {
    it('should create a week log for authenticated user', async () => {
      const createInput: CreateWeekLogInput = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
        planId: mockPlanId,
        notes: 'New week',
      };

      mockWeekLogService.create.mockResolvedValue(mockWeekLog);

      const result = await resolver.createWeekLog(
        createInput,
        mockContext(validUserId),
      );

      expect(service.create).toHaveBeenCalledWith(
        createInput,
        expect.any(Types.ObjectId),
      );

      const createMock = service.create as jest.Mock;

      const passedUserId = createMock.mock.calls[0][1];
      expect(passedUserId.toHexString()).toBe(validUserId);

      expect(result).toBe(mockWeekLog);
    });

    it('should create a week log for authenticated user2', async () => {
      const result = { _id: 'weekLogId' };

      jest.spyOn(service, 'create').mockResolvedValue(result as any);

      const response = await resolver.createWeekLog(
        validInputtoCreate,
        mockContext(validUserId),
      );

      expect(service.create).toHaveBeenCalledWith(
        validInputtoCreate,
        expect.any(Types.ObjectId),
      );
      expect(response).toBe(result);
    });

    it('should validate CreateWeekLogInput with required fields', async () => {
      const validContext = mockContext(validUserId);

      mockWeekLogService.create.mockResolvedValue({
        ...mockWeekLog,
        ...validInputtoCreate,
      });

      const result = await resolver.createWeekLog(
        validInputtoCreate,
        validContext,
      );

      expect(result?.startDate).toEqual(validInputtoCreate.startDate);
      expect(result?.endDate).toEqual(validInputtoCreate.endDate);
    });

    it('should reject creation with invalid date range', async () => {
      const invalidInput: CreateWeekLogInput = {
        startDate: new Date('2024-01-07'),
        endDate: new Date('2024-01-01'),
      };

      mockWeekLogService.create.mockRejectedValue(
        new Error('endDate must be after startDate'),
      );

      await expect(
        resolver.createWeekLog(invalidInput, mockUserId),
      ).rejects.toThrow();
    });

    it('should require authentication to create week log', async () => {
      const createInput: CreateWeekLogInput = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
      };

      // Simular que no hay usuario autenticado
      await expect(
        resolver.createWeekLog(createInput, undefined as any),
      ).rejects.toThrow();
    });
  });

  describe('findAllWeekLogs', () => {
    it('should return empty array if user has no week logs', async () => {
      mockWeekLogService.findAllByUser.mockResolvedValue([]);

      const result = await resolver.findAll(mockContext(validUserId));

      expect(result).toEqual([]);
    });

    it('should return all week logs for authenticated user', async () => {
      const mockWeekLogs = [
        mockWeekLog,
        { ...mockWeekLog, id: new Types.ObjectId().toString() },
      ];

      mockWeekLogService.findAllByUser.mockResolvedValue(mockWeekLogs);

      const result = await resolver.findAll(mockContext(validUserId));

      expect(service.findAllByUser).toHaveBeenCalledWith(validUserId);
      expect(result).toEqual(mockWeekLogs);
      expect(result?.length).toBe(2);
    });

    it('should require authentication', async () => {
      await expect(resolver.findAll(undefined as any)).rejects.toThrow();
    });
  });

  describe('findOneWeekLog', () => {
    it('should return a week log by id for authenticated user', async () => {
      mockWeekLogService.findOne.mockResolvedValue(mockWeekLog);

      const result = await resolver.findOne(
        mockWeekLogId,
        mockContext(validUserId),
      );

      expect(service.findOne).toHaveBeenCalledWith(mockWeekLogId, validUserId);
      expect(result).toEqual(mockWeekLog);
    });

    it('should throw error if week log does not exist', async () => {
      mockWeekLogService.findOne.mockRejectedValue(
        new Error('WeekLog not found'),
      );

      await expect(
        resolver.findOne(mockWeekLogId, mockContext(validUserId)),
      ).rejects.toThrow();
    });

    it('should throw error if trying to access another users week log', async () => {
      mockWeekLogService.findOne.mockRejectedValue(new Error('Forbidden'));

      await expect(
        resolver.findOne(mockWeekLogId, mockContext(validUserId)),
      ).rejects.toThrow();
    });

    it('should require authentication', async () => {
      await expect(
        resolver.findOne(mockWeekLogId, undefined as any),
        // ).rejects.toThrow();
      ).rejects.toThrow();
    });
  });

  describe('findActiveWeekLog', () => {
    it('should return the active week log for authenticated user', async () => {
      const activeWeekLog = {
        ...mockWeekLog,
        completed: false,
      };

      mockWeekLogService.findActiveWeekLog.mockResolvedValue(activeWeekLog);

      const result = await resolver.findActiveWeekLog(mockContext(validUserId));

      expect(service.findActiveWeekLog).toHaveBeenCalledWith(validUserId);
      expect(result).toEqual(activeWeekLog);
      expect(result?.hasActiveWeek).toBe(false);
    });

    it('should return null if no active week log exists', async () => {
      mockWeekLogService.findActiveWeekLog.mockResolvedValue(null);

      const result = await resolver.findActiveWeekLog(mockContext(validUserId));

      expect(result).toBeNull();
    });

    it('should require authentication', async () => {
      await expect(
        resolver.findActiveWeekLog(undefined as any),
      ).rejects.toThrow();
    });
  });

  describe('getCurrentWorkoutSession', () => {
    it('should return current workout session from active week log', async () => {
      const mockWorkoutSession = {
        id: 'workout-123',
        date: new Date(),
        routineDayId: 'routine-day-123',
        exercises: [],
        notes: 'Today workout',
      };

      mockWeekLogService.findActiveWeekLog.mockResolvedValue(
        mockWorkoutSession,
      );

      const result = await resolver.getCurrentWorkoutSession(
        mockContext(validUserId),
      );

      expect(service.findActiveWeekLog).toHaveBeenCalledWith(validUserId);
      expect(result).toEqual(mockWorkoutSession);
    });

    it('should return null if no workout session exists for today', async () => {
      mockWeekLogService.findActiveWeekLog.mockResolvedValue(null);

      const result = await resolver.findActiveWeekLog(mockContext(validUserId));

      expect(result).toBeNull();
    });

    it('should require authentication', async () => {
      await expect(
        resolver.findActiveWeekLog(undefined as any),
      ).rejects.toThrow();
    });
  });

  describe('updateWeekLog', () => {
    it('should update a week log for authenticated user', async () => {
      const updateInput: UpdateWeekLogInput = {
        id: mockWeekLogId,
        notes: 'Updated notes',
        completed: true,
      };

      const updatedWeekLog = {
        ...mockWeekLog,
        ...updateInput,
      };

      mockWeekLogService.update.mockResolvedValue(updatedWeekLog);

      const result = await resolver.updateWeekLog(
        updateInput,
        mockContext(validUserId),
      );

      expect(service.update).toHaveBeenCalledWith(
        updateInput,
        mockContext(validUserId),
      );
      expect(result?.notes).toBe('Updated notes');
      expect(result?.completed).toBe(true);
    });

    it('should throw error if week log does not exist', async () => {
      const updateInput: UpdateWeekLogInput = {
        id: mockWeekLogId,
        notes: 'Updated',
      };

      mockWeekLogService.update.mockRejectedValue(
        new Error('WeekLog not found'),
      );

      await expect(
        resolver.updateWeekLog(updateInput, mockContext(validUserId)),
      ).rejects.toThrow();
    });

    it('should throw error if trying to update another users week log', async () => {
      const updateInput: UpdateWeekLogInput = {
        id: mockWeekLogId,
        notes: 'Updated',
      };

      mockWeekLogService.update.mockRejectedValue(new Error('Forbidden'));

      await expect(
        resolver.updateWeekLog(updateInput, mockContext(validUserId)),
      ).rejects.toThrow();
    });

    it('should allow partial updates', async () => {
      const updateInput: UpdateWeekLogInput = {
        id: mockWeekLogId,
        completed: true,
      };

      const updatedWeekLog = {
        ...mockWeekLog,
        completed: true,
      };

      mockWeekLogService.update.mockResolvedValue(updatedWeekLog);

      const result = await resolver.updateWeekLog(
        updateInput,
        mockContext(validUserId),
      );

      expect(result?.completed).toBe(true);
    });

    it('should require authentication', async () => {
      const updateInput: UpdateWeekLogInput = {
        id: mockWeekLogId,
        notes: 'Updated',
      };

      await expect(
        resolver.updateWeekLog(updateInput, undefined as any),
      ).rejects.toThrow();
    });
  });

  describe('removeWeekLog', () => {
    it('should remove a week log for authenticated user', async () => {
      mockWeekLogService.remove.mockResolvedValue(mockWeekLog);

      const result = await resolver.removeWeekLog(
        mockWeekLogId,
        mockContext(validUserId),
      );

      expect(service.remove).toHaveBeenCalledWith(
        mockWeekLogId,
        mockContext(validUserId),
      );
      expect(result).toEqual(mockWeekLog);
    });

    it('should throw error if week log does not exist', async () => {
      mockWeekLogService.remove.mockRejectedValue(
        new Error('WeekLog not found'),
      );

      await expect(
        resolver.removeWeekLog(mockWeekLogId, mockContext(validUserId)),
      ).rejects.toThrow();
    });

    it('should throw error if trying to delete another users week log', async () => {
      mockWeekLogService.remove.mockRejectedValue(new Error('Forbidden'));

      await expect(
        resolver.removeWeekLog(mockWeekLogId, mockContext(validUserId)),
      ).rejects.toThrow();
    });

    it('should require authentication', async () => {
      await expect(
        resolver.removeWeekLog(mockWeekLogId, undefined as any),
      ).rejects.toThrow();
    });
  });

  describe('GraphQL Context Extraction', () => {
    it('should extract user from GraphQL execution context correctly', () => {
      const mockContexts = {
        req: {
          user: {
            id: mockContext(validUserId),
            email: 'test@example.com',
          },
        },
      };

      // Simular la extracción del usuario desde el contexto de GraphQL
      const userId = mockContexts.req.user.id;

      expect(userId).toBe(mockContext(validUserId));
      expect(mockContexts.req.user.email).toBe('test@example.com');
    });

    it('should handle missing user in context', () => {
      const mockContexts = {
        req: {},
      };

      expect(mockContexts.req).toBeUndefined();
    });
  });

  describe('Input Validation', () => {
    it('should validate CreateWeekLogInput DTO', async () => {
      const validInput: CreateWeekLogInput = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
        planId: mockPlanId,
        notes: 'Valid input',
      };

      mockWeekLogService.create.mockResolvedValue(mockWeekLog);

      const result = await resolver.createWeekLog(
        validInput,
        mockContext(validUserId),
      );

      expect(result).toBeDefined();
      expect(service.create).toHaveBeenCalledWith(
        validInput,
        mockContext(validUserId),
      );
    });

    it('should validate UpdateWeekLogInput DTO', async () => {
      const validInput: UpdateWeekLogInput = {
        id: mockWeekLogId,
        notes: 'Updated',
        completed: true,
      };

      mockWeekLogService.update.mockResolvedValue({
        ...mockWeekLog,
        ...validInput,
      });

      const result = await resolver.updateWeekLog(
        validInput,
        mockContext(validUserId),
      );

      expect(result).toBeDefined();
      expect(service.update).toHaveBeenCalledWith(
        validInput,
        mockContext(validUserId),
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockWeekLogService.findAll.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(resolver.findAll(mockContext(validUserId))).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should handle validation errors from service', async () => {
      const invalidInput: CreateWeekLogInput = {
        startDate: new Date('invalid'),
        endDate: new Date('2024-01-07'),
      };

      mockWeekLogService.create.mockRejectedValue(
        new Error('Invalid date format'),
      );

      await expect(
        resolver.createWeekLog(invalidInput, mockContext(validUserId)),
      ).rejects.toThrow();
    });
  });
});
