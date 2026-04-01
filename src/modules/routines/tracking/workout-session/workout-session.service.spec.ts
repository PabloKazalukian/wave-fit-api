import { Test, TestingModule } from '@nestjs/testing';
import { WorkoutSessionService } from './workout-session.service';
import { getModelToken } from '@nestjs/mongoose';
import { WorkoutSession } from './schema/workout-session.schema';
import { WeekLogService } from '../week-log/week-log.service';
import { WorkoutSessionValidator } from './workout-session.validator';
import { NotFoundException } from '@nestjs/common';

describe('WorkoutSessionService', () => {
  let service: WorkoutSessionService;
  let model: any;
  let validator: WorkoutSessionValidator;

  const mockWorkoutSession = {
    _id: 'session-id',
    userId: 'user-id',
    exercises: [],
    status: 'complete',
    edited: false,
  };

  const mockSessionModel = {
    findOne: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  };

  const mockWeekLogService = {
    findOne: jest.fn(),
  };

  const mockValidator = {
    validateUpdateWorkoutSession: jest.fn(),
    validateCreation: jest.fn(),
  };

  beforeEach(async () => {
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
    model = module.get(getModelToken(WorkoutSession.name));
    validator = module.get<WorkoutSessionValidator>(WorkoutSessionValidator);
  });

  describe('update', () => {
    it('should update a workout session successfully', async () => {
      const updateInput = {
        id: 'session-id',
        notes: 'New notes',
      };
      const userId = 'user-id';

      model.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWorkoutSession),
        populate: jest.fn().mockReturnThis(),
        ...mockWorkoutSession,
      });

      // Mock for findOne in update method (line 94)
      mockSessionModel.findOne.mockResolvedValue(mockWorkoutSession);

      model.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          ...mockWorkoutSession,
          notes: 'New notes',
          edited: true,
        }),
      });

      const result = await service.update('session-id', updateInput, userId);

      expect(result).toBeDefined();
      expect(result.notes).toBe('New notes');
      expect(result.edited).toBe(true);
      expect(validator.validateUpdateWorkoutSession).toHaveBeenCalledWith(
        updateInput,
        userId,
        mockWorkoutSession,
      );
      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'session-id',
        { notes: 'New notes', edited: true },
        { new: true },
      );
    });

    it('should throw NotFoundException if session does not exist', async () => {
      mockSessionModel.findOne.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', { id: 'non-existent-id' }, 'user-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
