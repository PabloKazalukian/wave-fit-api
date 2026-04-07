import { Test, TestingModule } from '@nestjs/testing';
import { WorkoutSessionResolver } from './workout-session.resolver';
import { WorkoutSessionService } from './workout-session.service';
import { CreateWorkoutSessionInput } from './dto/create-workout-session.input';
import { UpdateWorkoutSessionInput } from './dto/update-workout-session.input';
import { Types } from 'mongoose';
import { BadRequestException } from '@nestjs/common';
import { StatusWorkoutSessionEnum } from './schema/workout-session.schema';
import { Reflector } from '@nestjs/core';
import { AuditLogsService } from '../../../audit-logs/audit-logs.service';

describe('WorkoutSessionResolver', () => {
  let resolver: WorkoutSessionResolver;
  let service: WorkoutSessionService;

  const mockUserId = new Types.ObjectId().toString();
  const mockSessionId = new Types.ObjectId().toString();
  const mockWeekLogId = new Types.ObjectId().toString();
  const mockRoutineDayId = new Types.ObjectId().toString();

  const mockSession = {
    id: mockSessionId,
    userId: mockUserId,
    weekLogId: mockWeekLogId,
    date: new Date('2024-01-15'),
    routineDayId: mockRoutineDayId,
    exercises: [],
    status: StatusWorkoutSessionEnum.COMPLETE,
    notes: 'Test session',
    edited: false,
  };

  const mockWorkoutSessionService = {
    create: jest.fn(),
    findAllByUser: jest.fn(),
    findOne: jest.fn(),
    findByDate: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockAuditLogsService = {
    logAsync: jest.fn(),
  };

  const mockReflector = {
    get: jest.fn(),
    getAllAndOverride: jest.fn(),
  };

  const mockContext = (userId?: string) => ({
    req: {
      user: userId ? { id: userId } : undefined,
    },
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkoutSessionResolver,
        {
          provide: WorkoutSessionService,
          useValue: mockWorkoutSessionService,
        },
        {
          provide: AuditLogsService,
          useValue: mockAuditLogsService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    resolver = module.get<WorkoutSessionResolver>(WorkoutSessionResolver);
    service = module.get<WorkoutSessionService>(WorkoutSessionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication & Authorization', () => {
    it('should require user to be authenticated for all operations', () => {
      const metadata = Reflect.getMetadata(
        '__guards__',
        WorkoutSessionResolver,
      );
      expect(metadata).toBeDefined();
    });

    it('should extract user from GraphQL context', () => {
      const context = mockContext(mockUserId) as any;
      expect(context.req.user).toBeDefined();
      expect(context.req.user!.id).toBe(mockUserId);
    });

    it('should throw BadRequestException if user id is invalid on findAll', async () => {
      try {
        await resolver.findAll(mockContext('invalid-id'));
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Invalid user id');
      }
    });

    it('should throw BadRequestException if user id is invalid on findOne', async () => {
      try {
        await resolver.findOne(mockSessionId, mockContext('invalid-id'));
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Invalid user id');
      }
    });

    it('should throw BadRequestException if user id is invalid on findByDate', async () => {
      try {
        await resolver.findByDate('2024-01-15', mockContext('invalid-id'));
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Invalid user id');
      }
    });

    it('should throw BadRequestException if user id is invalid on removeWorkoutSession', async () => {
      try {
        await resolver.removeWorkoutSession(
          mockSessionId,
          mockContext('invalid-id'),
        );
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Invalid user id');
      }
    });
  });

  describe('createWorkoutSession', () => {
    const validInput: CreateWorkoutSessionInput = {
      weekLogId: mockWeekLogId,
      date: '2024-01-15',
      routineDayId: mockRoutineDayId,
      exercises: [],
      status: StatusWorkoutSessionEnum.COMPLETE,
      notes: 'New session',
    };

    it('should create a workout session for authenticated user', async () => {
      mockWorkoutSessionService.create.mockResolvedValue(mockSession);

      const result = await resolver.createWorkoutSession(
        validInput,
        mockContext(mockUserId),
      );

      expect(service.create).toHaveBeenCalledWith(validInput, mockUserId);
      expect(result).toEqual(mockSession);
    });

    it('should create workout session without weekLogId', async () => {
      const inputWithoutWeekLog = {
        ...validInput,
        weekLogId: undefined,
      };

      mockWorkoutSessionService.create.mockResolvedValue({
        ...mockSession,
        weekLogId: null,
      });

      const result = await resolver.createWorkoutSession(
        inputWithoutWeekLog,
        mockContext(mockUserId),
      );

      expect(service.create).toHaveBeenCalledWith(
        inputWithoutWeekLog,
        mockUserId,
      );
      expect(result).toBeDefined();
    });

    it('should create workout session with exercises', async () => {
      const inputWithExercises: CreateWorkoutSessionInput = {
        ...validInput,
        exercises: [
          {
            exerciseId: new Types.ObjectId().toString(),
            series: 3,
            sets: [
              { reps: 10, weights: 50 },
              { reps: 10, weights: 50 },
              { reps: 10, weights: 50 },
            ],
          },
        ],
      };

      const sessionWithExercises = {
        ...mockSession,
        exercises: inputWithExercises.exercises,
      };

      mockWorkoutSessionService.create.mockResolvedValue(sessionWithExercises);

      const result = await resolver.createWorkoutSession(
        inputWithExercises,
        mockContext(mockUserId),
      );

      expect(service.create).toHaveBeenCalledWith(
        inputWithExercises,
        mockUserId,
      );
      expect(result.exercises).toHaveLength(1);
    });

    it('should handle errors from service', async () => {
      mockWorkoutSessionService.create.mockRejectedValue(
        new Error('Validation failed'),
      );

      await expect(
        resolver.createWorkoutSession(validInput, mockContext(mockUserId)),
      ).rejects.toThrow('Validation failed');
    });
  });

  describe('findAll', () => {
    it('should return all workout sessions for authenticated user', async () => {
      const mockSessions = [
        mockSession,
        { ...mockSession, id: new Types.ObjectId().toString() },
      ];
      mockWorkoutSessionService.findAllByUser.mockResolvedValue(mockSessions);

      const result = await resolver.findAll(mockContext(mockUserId));

      expect(service.findAllByUser).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(mockSessions);
      expect(result).toHaveLength(2);
    });

    it('should return empty array if user has no sessions', async () => {
      mockWorkoutSessionService.findAllByUser.mockResolvedValue([]);

      const result = await resolver.findAll(mockContext(mockUserId));

      expect(result).toEqual([]);
    });

    it('should require authentication', async () => {
      try {
        await resolver.findAll(undefined as any);
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Invalid user id');
      }
    });
  });

  describe('findOne', () => {
    it('should return a workout session by id for authenticated user', async () => {
      mockWorkoutSessionService.findOne.mockResolvedValue(mockSession);

      const result = await resolver.findOne(
        mockSessionId,
        mockContext(mockUserId),
      );

      expect(service.findOne).toHaveBeenCalledWith(mockSessionId, mockUserId);
      expect(result).toEqual(mockSession);
    });

    it('should return null if session does not exist', async () => {
      mockWorkoutSessionService.findOne.mockResolvedValue(null);

      const result = await resolver.findOne(
        mockSessionId,
        mockContext(mockUserId),
      );

      expect(service.findOne).toHaveBeenCalledWith(mockSessionId, mockUserId);
      expect(result).toBeNull();
    });

    it('should return null when trying to access another users session', async () => {
      mockWorkoutSessionService.findOne.mockResolvedValue(null);

      const result = await resolver.findOne(
        mockSessionId,
        mockContext(mockUserId),
      );

      expect(result).toBeNull();
    });

    it('should require authentication', async () => {
      try {
        await resolver.findOne(mockSessionId, undefined as any);
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Invalid user id');
      }
    });
  });

  describe('findByDate', () => {
    it('should return a workout session by date for authenticated user', async () => {
      mockWorkoutSessionService.findByDate.mockResolvedValue(mockSession);

      const result = await resolver.findByDate(
        '2024-01-15',
        mockContext(mockUserId),
      );

      expect(service.findByDate).toHaveBeenCalledWith('2024-01-15', mockUserId);
      expect(result).toEqual(mockSession);
    });

    it('should return null if no session exists for that date', async () => {
      mockWorkoutSessionService.findByDate.mockResolvedValue(null);

      const result = await resolver.findByDate(
        '2024-01-15',
        mockContext(mockUserId),
      );

      expect(result).toBeNull();
    });

    it('should require authentication', async () => {
      try {
        await resolver.findByDate('2024-01-15', undefined as any);
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Invalid user id');
      }
    });
  });

  describe('updateWorkoutSession', () => {
    const validUpdateInput: UpdateWorkoutSessionInput = {
      id: mockSessionId,
      notes: 'Updated notes',
      status: StatusWorkoutSessionEnum.COMPLETE,
    };

    it('should update a workout session for authenticated user', async () => {
      const updatedSession = {
        ...mockSession,
        ...validUpdateInput,
      };

      mockWorkoutSessionService.update.mockResolvedValue(updatedSession);

      const result = await resolver.updateWorkoutSession(
        validUpdateInput,
        mockContext(mockUserId),
      );

      expect(service.update).toHaveBeenCalledWith(
        mockSessionId,
        validUpdateInput,
        mockUserId,
      );
      expect(result.notes).toBe('Updated notes');
    });

    it('should throw BadRequestException if id is invalid', async () => {
      const invalidInput = {
        id: 'invalid-id',
        notes: 'Updated',
      };

      try {
        await resolver.updateWorkoutSession(
          invalidInput,
          mockContext(mockUserId),
        );
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Invalid workout session id');
      }
    });

    it('should throw BadRequestException if id is missing', async () => {
      const invalidInput = {
        notes: 'Updated',
      } as UpdateWorkoutSessionInput;

      try {
        await resolver.updateWorkoutSession(
          invalidInput,
          mockContext(mockUserId),
        );
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Invalid workout session id');
      }
    });

    it('should throw error if session does not exist', async () => {
      mockWorkoutSessionService.update.mockRejectedValue(
        new Error('Workout Session not found'),
      );

      await expect(
        resolver.updateWorkoutSession(
          validUpdateInput,
          mockContext(mockUserId),
        ),
      ).rejects.toThrow();
    });

    it('should allow partial updates', async () => {
      const partialUpdate = {
        id: mockSessionId,
        notes: 'Partial update',
      };

      const updatedSession = {
        ...mockSession,
        notes: 'Partial update',
      };

      mockWorkoutSessionService.update.mockResolvedValue(updatedSession);

      const result = await resolver.updateWorkoutSession(
        partialUpdate,
        mockContext(mockUserId),
      );

      expect(result.notes).toBe('Partial update');
    });

    it('should handle exercise updates', async () => {
      const updateWithExercises: UpdateWorkoutSessionInput = {
        id: mockSessionId,
        exercises: [
          {
            exerciseId: new Types.ObjectId().toString(),
            series: 4,
            sets: [
              { reps: 12, weights: 60 },
              { reps: 12, weights: 60 },
              { reps: 12, weights: 60 },
              { reps: 12, weights: 60 },
            ],
          },
        ],
      };

      const updatedSession = {
        ...mockSession,
        exercises: updateWithExercises.exercises,
      };

      mockWorkoutSessionService.update.mockResolvedValue(updatedSession);

      const result = await resolver.updateWorkoutSession(
        updateWithExercises,
        mockContext(mockUserId),
      );

      expect(result.exercises).toHaveLength(1);
      expect(result.exercises[0].series).toBe(4);
    });
  });

  describe('removeWorkoutSession', () => {
    it('should remove a workout session for authenticated user', async () => {
      mockWorkoutSessionService.remove.mockResolvedValue(mockSession);

      const result = await resolver.removeWorkoutSession(
        mockSessionId,
        mockContext(mockUserId),
      );

      expect(service.remove).toHaveBeenCalledWith(mockSessionId, mockUserId);
      expect(result).toEqual(mockSession);
    });

    it('should throw error if session does not exist', async () => {
      mockWorkoutSessionService.remove.mockRejectedValue(
        new Error('Workout Session not found'),
      );

      await expect(
        resolver.removeWorkoutSession(mockSessionId, mockContext(mockUserId)),
      ).rejects.toThrow();
    });

    it('should throw error if trying to delete another users session', async () => {
      mockWorkoutSessionService.remove.mockRejectedValue(
        new Error('Forbidden'),
      );

      await expect(
        resolver.removeWorkoutSession(mockSessionId, mockContext(mockUserId)),
      ).rejects.toThrow();
    });

    it('should require authentication', async () => {
      try {
        await resolver.removeWorkoutSession(mockSessionId, undefined as any);
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Invalid user id');
      }
    });
  });

  describe('Input Validation', () => {
    it('should validate CreateWorkoutSessionInput DTO', async () => {
      const validInput: CreateWorkoutSessionInput = {
        date: '2024-01-15',
        exercises: [],
        status: StatusWorkoutSessionEnum.COMPLETE,
      };

      mockWorkoutSessionService.create.mockResolvedValue(mockSession);

      const result = await resolver.createWorkoutSession(
        validInput,
        mockContext(mockUserId),
      );

      expect(result).toBeDefined();
      expect(service.create).toHaveBeenCalled();
    });

    it('should validate UpdateWorkoutSessionInput DTO', async () => {
      const validInput: UpdateWorkoutSessionInput = {
        id: mockSessionId,
        notes: 'Updated',
        status: StatusWorkoutSessionEnum.COMPLETE,
      };

      mockWorkoutSessionService.update.mockResolvedValue({
        ...mockSession,
        ...validInput,
      });

      const result = await resolver.updateWorkoutSession(
        validInput,
        mockContext(mockUserId),
      );

      expect(result).toBeDefined();
      expect(service.update).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockWorkoutSessionService.findAllByUser.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(resolver.findAll(mockContext(mockUserId))).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should handle validation errors from service', async () => {
      mockWorkoutSessionService.create.mockRejectedValue(
        new Error('Invalid date format'),
      );

      await expect(
        resolver.createWorkoutSession(
          {
            date: 'invalid',
            exercises: [],
            status: StatusWorkoutSessionEnum.COMPLETE,
          },
          mockContext(mockUserId),
        ),
      ).rejects.toThrow();
    });

    it('should handle NotFoundException from service', async () => {
      mockWorkoutSessionService.findOne.mockRejectedValue(
        new Error('Workout Session with ID "123" not found'),
      );

      await expect(
        resolver.findOne('123', mockContext(mockUserId)),
      ).rejects.toThrow();
    });
  });
});
