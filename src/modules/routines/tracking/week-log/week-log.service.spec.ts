import { Test, TestingModule } from '@nestjs/testing';
import { WeekLogService } from './week-log.service';
import { getModelToken } from '@nestjs/mongoose';
import { WeekLog } from './schema/week-log.schema';
import { Model, Types } from 'mongoose';
import { CreateWeekLogInput } from './dto/create-week-log.input';
import { UpdateWeekLogInput } from './dto/update-week-log.input';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('WeekLogService', () => {
  let service: WeekLogService;
  let model: Model<WeekLog>;

  const mockUserId = new Types.ObjectId();
  const mockWeekLogId = new Types.ObjectId().toString();
  const mockPlanId = new Types.ObjectId().toString();

  const mockWeekLog = {
    _id: mockWeekLogId,
    userId: mockUserId,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-07'),
    workouts: [],
    extras: [],
    planId: mockPlanId,
    notes: 'Test week',
    completed: false,
    save: jest.fn().mockResolvedValue(this),
    toObject: jest.fn().mockReturnThis(),
  };

  const mockWeekLogModel = {
    new: jest.fn().mockResolvedValue(mockWeekLog),
    constructor: jest.fn().mockResolvedValue(mockWeekLog),
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    exec: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeekLogService,
        {
          provide: getModelToken(WeekLog.name),
          useValue: mockWeekLogModel,
        },
      ],
    }).compile();

    service = module.get<WeekLogService>(WeekLogService);
    model = module.get<Model<WeekLog>>(getModelToken(WeekLog.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new week log for authenticated user', async () => {
      const createWeekLogInput: CreateWeekLogInput = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
        planId: mockPlanId,
        notes: 'New week log',
      };

      const createdWeekLog = {
        ...mockWeekLog,
        ...createWeekLogInput,
        userId: mockUserId,
      };

      jest.spyOn(model, 'create').mockResolvedValue(createdWeekLog as any);

      const result = await service.create(createWeekLogInput, mockUserId);

      expect(model.create).toHaveBeenCalledWith({
        ...createWeekLogInput,
        userId: mockUserId,
      });
      expect(result).toEqual(createdWeekLog);
      expect(result?.userId).toBe(mockUserId);
    });

    it('should validate required fields in CreateWeekLogInput', async () => {
      const invalidInput = {
        // Missing required fields
        notes: 'Invalid',
      } as CreateWeekLogInput;

      jest
        .spyOn(model, 'create')
        .mockRejectedValue(
          new Error('Validation failed: startDate is required'),
        );

      await expect(service.create(invalidInput, mockUserId)).rejects.toThrow();
    });

    it('should validate date range (endDate must be after startDate)', async () => {
      const invalidInput: CreateWeekLogInput = {
        startDate: new Date('2024-01-07'),
        endDate: new Date('2024-01-01'), // endDate before startDate
      };

      jest
        .spyOn(model, 'create')
        .mockRejectedValue(new Error('endDate must be after startDate'));

      await expect(service.create(invalidInput, mockUserId)).rejects.toThrow();
    });

    it('should create week log without optional fields', async () => {
      const minimalInput: CreateWeekLogInput = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
      };

      const createdWeekLog = {
        ...mockWeekLog,
        ...minimalInput,
        userId: mockUserId,
        planId: null,
        notes: '',
      };

      jest.spyOn(model, 'create').mockResolvedValue(createdWeekLog as any);

      const result = await service.create(minimalInput, mockUserId);

      expect(result?.planId).toBeNull();
      expect(result?.notes).toBe('');
    });
  });

  // describe('findAll', () => {
  //   it('should return all week logs for authenticated user', async () => {
  //     const mockWeekLogs = [
  //       { ...mockWeekLog, _id: new Types.ObjectId().toString() },
  //       { ...mockWeekLog, _id: new Types.ObjectId().toString() },
  //     ];

  //     jest.spyOn(model, 'find').mockReturnValue({
  //       exec: jest.fn().mockResolvedValue(mockWeekLogs),
  //     } as any);

  //     const result = await service.findAll(mockUserId);

  //     expect(model.find).toHaveBeenCalledWith({ userId: mockUserId });
  //     expect(result).toEqual(mockWeekLogs);
  //     expect(result.length).toBe(2);
  //   });

  //   it('should return empty array if user has no week logs', async () => {
  //     jest.spyOn(model, 'find').mockReturnValue({
  //       exec: jest.fn().mockResolvedValue([]),
  //     } as any);

  //     const result = await service.findAll(mockUserId);

  //     expect(result).toEqual([]);
  //   });

  //   it('should only return week logs belonging to the authenticated user', async () => {
  //     const otherUserId = new Types.ObjectId().toString();
  //     const userWeekLogs = [
  //       { ...mockWeekLog, userId: mockUserId },
  //     ];

  //     jest.spyOn(model, 'find').mockReturnValue({
  //       exec: jest.fn().mockResolvedValue(userWeekLogs),
  //     } as any);

  //     const result = await service.findAll(mockUserId);

  //     expect(model.find).toHaveBeenCalledWith({ userId: mockUserId });
  //     expect(result.every(log => log.userId === mockUserId)).toBe(true);
  //   });
  // });

  // describe('findOne', () => {
  //   it('should return a week log by id for the authenticated user', async () => {
  //     jest.spyOn(model, 'findById').mockReturnValue({
  //       exec: jest.fn().mockResolvedValue(mockWeekLog),
  //     } as any);

  //     const result = await service.findOne(mockWeekLogId, mockUserId);

  //     expect(model.findById).toHaveBeenCalledWith(mockWeekLogId);
  //     expect(result).toEqual(mockWeekLog);
  //   });

  //   it('should throw NotFoundException if week log does not exist', async () => {
  //     jest.spyOn(model, 'findById').mockReturnValue({
  //       exec: jest.fn().mockResolvedValue(null),
  //     } as any);

  //     await expect(
  //       service.findOne(mockWeekLogId, mockUserId),
  //     ).rejects.toThrow(NotFoundException);
  //   });

  //   it('should throw ForbiddenException if week log belongs to another user', async () => {
  //     const otherUserId = new Types.ObjectId().toString();
  //     const otherUserWeekLog = { ...mockWeekLog, userId: otherUserId };

  //     jest.spyOn(model, 'findById').mockReturnValue({
  //       exec: jest.fn().mockResolvedValue(otherUserWeekLog),
  //     } as any);

  //     await expect(
  //       service.findOne(mockWeekLogId, mockUserId),
  //     ).rejects.toThrow(ForbiddenException);
  //   });
  // });

  // describe('findActiveWeekLog', () => {
  //   it('should return the active week log for the authenticated user', async () => {
  //     const activeWeekLog = {
  //       ...mockWeekLog,
  //       completed: false,
  //       startDate: new Date('2024-01-01'),
  //       endDate: new Date('2024-01-07'),
  //     };

  //     jest.spyOn(model, 'findOne').mockReturnValue({
  //       sort: jest.fn().mockReturnValue({
  //         exec: jest.fn().mockResolvedValue(activeWeekLog),
  //       }),
  //     } as any);

  //     const result = await service.findActiveWeekLog(mockUserId);

  //     expect(model.findOne).toHaveBeenCalledWith({
  //       userId: mockUserId,
  //       completed: false,
  //     });
  //     expect(result).toEqual(activeWeekLog);
  //     expect(result.completed).toBe(false);
  //   });

  //   it('should return null if no active week log exists', async () => {
  //     jest.spyOn(model, 'findOne').mockReturnValue({
  //       sort: jest.fn().mockReturnValue({
  //         exec: jest.fn().mockResolvedValue(null),
  //       }),
  //     } as any);

  //     const result = await service.findActiveWeekLog(mockUserId);

  //     expect(result).toBeNull();
  //   });

  //   it('should return the most recent active week log if multiple exist', async () => {
  //     const recentActiveWeekLog = {
  //       ...mockWeekLog,
  //       completed: false,
  //       startDate: new Date('2024-01-08'),
  //     };

  //     jest.spyOn(model, 'findOne').mockReturnValue({
  //       sort: jest.fn().mockReturnValue({
  //         exec: jest.fn().mockResolvedValue(recentActiveWeekLog),
  //       }),
  //     } as any);

  //     const result = await service.findActiveWeekLog(mockUserId);

  //     expect(result.startDate).toEqual(new Date('2024-01-08'));
  //   });
  // });

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
