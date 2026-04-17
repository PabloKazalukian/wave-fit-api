import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { WorkoutSessionService } from './workout-session.service';
import { WorkoutSession } from './schema/workout-session.schema';
import { WeekLogService } from '../week-log/week-log.service';
import { WorkoutSessionValidator } from './workout-session.validator';
import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { StatusWorkoutSessionEnum } from './schema/workout-session.schema';

describe('WorkoutSessionService', () => {
  let service: WorkoutSessionService;

  const mockUserId = new Types.ObjectId().toString();
  const mockSessionId = new Types.ObjectId().toString();
  const mockWeekLogId = new Types.ObjectId().toString();
  const mockRoutineDayId = new Types.ObjectId().toString();

  const mockWorkoutSession = {
    _id: mockSessionId,
    userId: mockUserId,
    weekLogId: mockWeekLogId,
    date: new Date('2024-01-15'),
    routineDayId: mockRoutineDayId,
    exercises: [],
    status: StatusWorkoutSessionEnum.COMPLETE,
    notes: 'Test session',
    edited: false,
    deleted: false,
  };

  let mockSessionModel: any;
  let mockWeekLogService: any;
  let mockValidator: any;

  beforeEach(async () => {
    mockSessionModel = {
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      insertMany: jest.fn(),
    };

    mockWeekLogService = {
      findOne: jest.fn(),
    };

    mockValidator = {
      validateUpdateWorkoutSession: jest.fn().mockResolvedValue(undefined),
      validateCreation: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkoutSessionService,
        {
          provide: getModelToken(WorkoutSession.name),
          useValue: mockSessionModel,
        },
        {
          provide: WeekLogService,
          useValue: mockWeekLogService,
        },
        {
          provide: WorkoutSessionValidator,
          useValue: mockValidator,
        },
      ],
    }).compile();

    service = module.get<WorkoutSessionService>(WorkoutSessionService);
    // const model = module.get(getModelToken(WorkoutSession.name));
    // const weekLogService = module.get<WeekLogService>(WeekLogService);
    // const validator = module.get<WorkoutSessionValidator>(
    //   WorkoutSessionValidator,
    // );
  });

  describe('create', () => {
    const validInput = {
      weekLogId: mockWeekLogId,
      date: '2024-01-15',
      routineDayId: mockRoutineDayId,
      exercises: [],
      status: StatusWorkoutSessionEnum.COMPLETE,
      notes: 'New session',
    };

    it('should create a workout session successfully', async () => {
      mockWeekLogService.findOne.mockResolvedValue({ _id: mockWeekLogId });
      mockSessionModel.create.mockResolvedValue(mockWorkoutSession);

      const result = await service.create(validInput, mockUserId);

      expect(result).toEqual(mockWorkoutSession);
    });

    it('should create session without weekLogId', async () => {
      const inputWithoutWeekLog = { ...validInput, weekLogId: undefined };
      mockSessionModel.create.mockResolvedValue({
        ...mockWorkoutSession,
        weekLogId: null,
      });

      const result = await service.create(inputWithoutWeekLog, mockUserId);

      expect(result).toBeDefined();
      expect(mockWeekLogService.findOne).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if weekLogId is provided but not found', async () => {
      mockWeekLogService.findOne.mockResolvedValue(null);

      await expect(service.create(validInput, mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw if validator fails', async () => {
      mockWeekLogService.findOne.mockResolvedValue({ _id: mockWeekLogId });
      mockValidator.validateCreation = jest
        .fn()
        .mockRejectedValue(new Error('Validation failed'));

      await expect(service.create(validInput, mockUserId)).rejects.toThrow(
        'Validation failed',
      );
    });

    it('should create session with exercises', async () => {
      const inputWithExercises = {
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
        ...mockWorkoutSession,
        exercises: inputWithExercises.exercises,
      };
      mockWeekLogService.findOne.mockResolvedValue({ _id: mockWeekLogId });
      mockSessionModel.create.mockResolvedValue(sessionWithExercises);

      const result = await service.create(inputWithExercises, mockUserId);

      expect(result.exercises).toHaveLength(1);
    });

    it('should use empty notes if not provided', async () => {
      const inputWithoutNotes = { ...validInput, notes: undefined };
      mockWeekLogService.findOne.mockResolvedValue({ _id: mockWeekLogId });
      mockSessionModel.create.mockResolvedValue({
        ...mockWorkoutSession,
        notes: '',
      });

      await service.create(inputWithoutNotes, mockUserId);

      expect(mockSessionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ notes: '' }),
      );
    });
  });

  describe('findAllByUser', () => {
    it('should return all workout sessions for a user', async () => {
      const mockSessions = [
        mockWorkoutSession,
        { _id: new Types.ObjectId().toString() },
      ];

      mockSessionModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockSessions),
        }),
      });

      const result = await service.findAllByUser(mockUserId);

      expect(result).toEqual(mockSessions);
    });

    it('should return empty array if no sessions exist', async () => {
      mockSessionModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.findAllByUser(mockUserId);

      expect(result).toEqual([]);
    });

    it('should exclude deleted sessions', async () => {
      mockSessionModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([mockWorkoutSession]),
        }),
      });

      await service.findAllByUser(mockUserId);

      expect(mockSessionModel.find).toHaveBeenCalledWith({
        userId: mockUserId,
        deleted: { $ne: true },
      });
    });
  });

  describe('findOne', () => {
    it('should return a workout session by id for authenticated user', async () => {
      mockSessionModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockWorkoutSession),
        }),
      });

      const result = await service.findOne(mockSessionId, mockUserId);

      expect(result).toEqual(mockWorkoutSession);
    });

    it('should return null if session does not exist', async () => {
      mockSessionModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      const result = await service.findOne(mockSessionId, mockUserId);

      expect(result).toBeNull();
    });
  });

  describe('findByDate', () => {
    it('should return a workout session by date', async () => {
      mockSessionModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockWorkoutSession),
        }),
      });

      const result = await service.findByDate('2024-01-15', mockUserId);

      expect(result).toEqual(mockWorkoutSession);
    });

    it('should return null if no session exists for that date', async () => {
      mockSessionModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      const result = await service.findByDate('2024-01-15', mockUserId);

      expect(result).toBeNull();
    });

    it('should search for sessions within the date range', async () => {
      mockSessionModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockWorkoutSession),
        }),
      });

      await service.findByDate('2024-01-15', mockUserId);

      const calledWith = mockSessionModel.findOne.mock.calls[0][0];
      expect(calledWith.date).toBeDefined();
    });
  });

  describe('insertMany', () => {
    it('should insert multiple workout sessions', async () => {
      const sessionsToInsert = [
        { userId: mockUserId, date: new Date(), exercises: [] },
        { userId: mockUserId, date: new Date(), exercises: [] },
      ];

      mockSessionModel.insertMany.mockResolvedValue(sessionsToInsert);

      const result = await service.insertMany(sessionsToInsert as any);

      expect(result).toEqual(sessionsToInsert);
    });

    it('should handle empty array', async () => {
      mockSessionModel.insertMany.mockResolvedValue([]);

      const result = await service.insertMany([]);

      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    const validUpdateInput = {
      id: mockSessionId,
      notes: 'Updated notes',
      status: StatusWorkoutSessionEnum.COMPLETE,
    };

    it('should update a workout session successfully', async () => {
      mockSessionModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockWorkoutSession),
        }),
      });

      mockSessionModel.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            ...mockWorkoutSession,
            ...validUpdateInput,
            edited: true,
          }),
        }),
      });

      const result = await service.update(
        mockSessionId,
        validUpdateInput,
        mockUserId,
      );

      expect(result.notes).toBe('Updated notes');
      expect(result.edited).toBe(true);
    });

    it('should throw NotFoundException if session does not exist', async () => {
      mockSessionModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      mockSessionModel.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        service.update(
          'non-existent-id',
          { id: 'non-existent-id' },
          mockUserId,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should normalize exercises series from sets count', async () => {
      const updateWithExercises = {
        id: mockSessionId,
        exercises: [
          {
            exerciseId: new Types.ObjectId().toString(),
            sets: [
              { reps: 12, weights: 60 },
              { reps: 12, weights: 60 },
              { reps: 12, weights: 60 },
            ],
          },
        ],
      };

      mockSessionModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockWorkoutSession),
        }),
      });

      mockSessionModel.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest
            .fn()
            .mockResolvedValue({ ...mockWorkoutSession, edited: true }),
        }),
      });

      await service.update(
        mockSessionId,
        updateWithExercises as any,
        mockUserId,
      );

      const calledWith = mockSessionModel.findByIdAndUpdate.mock.calls[0][1];
      expect(calledWith.exercises[0].series).toBe(3);
    });

    it('should call validator before update', async () => {
      mockSessionModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockWorkoutSession),
        }),
      });

      mockSessionModel.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockWorkoutSession),
        }),
      });

      await service.update(mockSessionId, validUpdateInput, mockUserId);

      expect(mockValidator.validateUpdateWorkoutSession).toHaveBeenCalled();
    });

    it('should throw if validator fails', async () => {
      mockSessionModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockWorkoutSession),
        }),
      });

      mockValidator.validateUpdateWorkoutSession = jest
        .fn()
        .mockRejectedValue(new Error('Validation failed'));

      await expect(
        service.update(mockSessionId, validUpdateInput, mockUserId),
      ).rejects.toThrow('Validation failed');
    });

    it('should set edited to true on update', async () => {
      mockSessionModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockWorkoutSession),
        }),
      });

      mockSessionModel.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest
            .fn()
            .mockResolvedValue({ ...mockWorkoutSession, edited: true }),
        }),
      });

      await service.update(mockSessionId, validUpdateInput, mockUserId);

      const calledWith = mockSessionModel.findByIdAndUpdate.mock.calls[0][1];
      expect(calledWith.edited).toBe(true);
    });

    it('should exclude id from update data', async () => {
      mockSessionModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockWorkoutSession),
        }),
      });

      mockSessionModel.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockWorkoutSession),
        }),
      });

      await service.update(mockSessionId, validUpdateInput, mockUserId);

      const calledWith = mockSessionModel.findByIdAndUpdate.mock.calls[0][1];
      expect(calledWith.id).toBeUndefined();
    });

    it('should throw NotFoundException if findByIdAndUpdate returns null', async () => {
      mockSessionModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockWorkoutSession),
        }),
      });

      mockSessionModel.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        service.update(mockSessionId, validUpdateInput, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete a workout session', async () => {
      mockSessionModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockWorkoutSession),
        }),
      });

      const deletedSession = {
        ...mockWorkoutSession,
        deleted: true,
        deletedAt: new Date(),
      };
      mockSessionModel.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(deletedSession),
        }),
      });

      const result = await service.remove(mockSessionId, mockUserId);

      expect(result!.deleted).toBe(true);
      expect(result!.deletedAt).toBeDefined();
    });

    it('should throw NotFoundException if session does not exist', async () => {
      const mockChain = {
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      };
      mockSessionModel.findOne = jest.fn().mockReturnValue(mockChain);

      let errorThrown = false;
      try {
        await service.remove('non-existent-id', mockUserId);
      } catch {
        errorThrown = true;
      }
      expect(errorThrown).toBe(true);
    });

    it('should set deletedAt timestamp', async () => {
      mockSessionModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockWorkoutSession),
        }),
      });

      mockSessionModel.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            ...mockWorkoutSession,
            deleted: true,
            deletedAt: new Date(),
          }),
        }),
      });

      const result = await service.remove(mockSessionId, mockUserId);

      expect(result!.deletedAt).toBeDefined();
    });

    it('should use findByIdAndUpdate with new: true', async () => {
      mockSessionModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockWorkoutSession),
        }),
      });

      mockSessionModel.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockWorkoutSession),
        }),
      });

      await service.remove(mockSessionId, mockUserId);

      expect(mockSessionModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockSessionId,
        { deleted: true, deletedAt: expect.any(Date) },
        { new: true },
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors in findAllByUser', async () => {
      mockSessionModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockRejectedValue(new Error('Database error')),
        }),
      });

      await expect(service.findAllByUser(mockUserId)).rejects.toThrow(
        'Database error',
      );
    });

    it('should handle database errors in findOne', async () => {
      mockSessionModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockRejectedValue(new Error('Database error')),
        }),
      });

      await expect(service.findOne(mockSessionId, mockUserId)).rejects.toThrow(
        'Database error',
      );
    });

    it('should handle database errors in findByDate', async () => {
      mockSessionModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockRejectedValue(new Error('Database error')),
        }),
      });

      await expect(
        service.findByDate('2024-01-15', mockUserId),
      ).rejects.toThrow('Database error');
    });

    it('should handle database errors in create', async () => {
      mockWeekLogService.findOne.mockResolvedValue({ _id: mockWeekLogId });
      mockSessionModel.create.mockRejectedValue(new Error('Database error'));

      await expect(
        service.create(
          {
            date: '2024-01-15',
            exercises: [],
            status: StatusWorkoutSessionEnum.COMPLETE,
          },
          mockUserId,
        ),
      ).rejects.toThrow('Database error');
    });

    it('should handle database errors in remove', async () => {
      mockSessionModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockWorkoutSession),
        }),
      });

      mockSessionModel.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockRejectedValue(new Error('Database error')),
        }),
      });

      await expect(service.remove(mockSessionId, mockUserId)).rejects.toThrow(
        'Database error',
      );
    });
  });
});
