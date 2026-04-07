import { Test, TestingModule } from '@nestjs/testing';
import { ExtraSessionService } from './extra-session.service';
import { getModelToken } from '@nestjs/mongoose';
import { ExtraSession } from './schema/extra-session.schema';
import { WorkoutSession } from '../workout-session/schema/workout-session.schema';
import { Types } from 'mongoose';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ExtraSessionCategory } from './extra-session.catalog';

describe('ExtraSessionService', () => {
  let service: ExtraSessionService;
  let extraSessionModelMock: any;
  let workoutSessionModelMock: any;

  const mockUserId = new Types.ObjectId().toHexString();
  const mockWorkoutSessionId = new Types.ObjectId().toHexString();
  const mockExtraSessionId = new Types.ObjectId().toHexString();

  beforeEach(async () => {
    extraSessionModelMock = {
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      deleteOne: jest.fn(),
    };

    workoutSessionModelMock = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExtraSessionService,
        {
          provide: getModelToken(ExtraSession.name),
          useValue: extraSessionModelMock,
        },
        {
          provide: getModelToken(WorkoutSession.name),
          useValue: workoutSessionModelMock,
        },
      ],
    }).compile();

    service = module.get<ExtraSessionService>(ExtraSessionService);
  });

  describe('create', () => {
    const createInput = {
      workoutSessionId: mockWorkoutSessionId,
      date: new Date().toISOString(),
      discipline: 'running',
      duration: 30,
      intensityLevel: 3,
    };

    it('should throw NotFoundException if WorkoutSession does not exist', async () => {
      workoutSessionModelMock.findOne.mockResolvedValue(null);

      await expect(service.create(createInput, mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if discipline is invalid', async () => {
      workoutSessionModelMock.findOne.mockResolvedValue({ id: mockWorkoutSessionId });

      const invalidInput = { ...createInput, discipline: 'invalid_discipline' };

      await expect(service.create(invalidInput, mockUserId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create ExtraSession with calculated calories', async () => {
      workoutSessionModelMock.findOne.mockResolvedValue({ id: mockWorkoutSessionId });
      extraSessionModelMock.create.mockResolvedValue({ id: mockExtraSessionId });

      await service.create(createInput, mockUserId);

      expect(extraSessionModelMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          category: ExtraSessionCategory.CARDIO,
          discipline: 'running',
          calories: 300, // 600 cal/h -> 300 cal/30m
        }),
      );
    });

    it('should create ExtraSession with explicit calories', async () => {
      workoutSessionModelMock.findOne.mockResolvedValue({ id: mockWorkoutSessionId });
      extraSessionModelMock.create.mockResolvedValue({ id: mockExtraSessionId });

      const inputWithCalories = { ...createInput, calories: 500 };
      await service.create(inputWithCalories, mockUserId);

      expect(extraSessionModelMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          calories: 500,
        }),
      );
    });
  });

  describe('findAllByUser', () => {
    it('should return an array of ExtraSessions', async () => {
      extraSessionModelMock.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
      const result = await service.findAllByUser(mockUserId);
      expect(result).toEqual([]);
      expect(extraSessionModelMock.find).toHaveBeenCalledWith({ userId: mockUserId });
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if not found', async () => {
      extraSessionModelMock.findOne.mockResolvedValue(null);
      await expect(service.findOne(mockExtraSessionId, mockUserId)).rejects.toThrow(NotFoundException);
    });

    it('should return found ExtraSession', async () => {
      extraSessionModelMock.findOne.mockResolvedValue({ id: mockExtraSessionId });
      const result = await service.findOne(mockExtraSessionId, mockUserId);
      expect(result).toBeDefined();
    });
  });

  describe('findByWorkoutSession', () => {
    it('should find extra sessions related to a workout session', async () => {
      extraSessionModelMock.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
      const result = await service.findByWorkoutSession(mockWorkoutSessionId, mockUserId);
      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('should throw NotFoundException if not found', async () => {
      extraSessionModelMock.findOne.mockResolvedValue(null);
      await expect(service.update(mockExtraSessionId, { id: mockExtraSessionId }, mockUserId)).rejects.toThrow(NotFoundException);
    });

    it('should recalculate calories if discipline/duration changed without explicit calories', async () => {
      const mockSession: any = {
        save: jest.fn(),
        discipline: 'running',
        duration: 30, // currently running 30m
      };
      extraSessionModelMock.findOne.mockResolvedValue(mockSession);

      await service.update(mockExtraSessionId, { id: mockExtraSessionId, duration: 60 }, mockUserId);
      
      expect(mockSession.calories).toBe(600); // 60m of running = 600 calories
      expect(mockSession.save).toHaveBeenCalled();
    });

    it('should use explicit calories if provided during update', async () => {
      const mockSession: any = {
        save: jest.fn(),
        discipline: 'running',
        duration: 30,
      };
      extraSessionModelMock.findOne.mockResolvedValue(mockSession);

      await service.update(mockExtraSessionId, { id: mockExtraSessionId, duration: 60, calories: 100 }, mockUserId);
      
      expect(mockSession.calories).toBe(100);
      expect(mockSession.save).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should return true if deleted', async () => {
      extraSessionModelMock.deleteOne.mockResolvedValue({ deletedCount: 1 });
      const result = await service.remove(mockExtraSessionId, mockUserId);
      expect(result).toBe(true);
    });
  });
});
