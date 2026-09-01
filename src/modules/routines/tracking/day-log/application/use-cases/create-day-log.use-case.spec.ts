import { Test, TestingModule } from '@nestjs/testing';
import { CreateDayLogUseCase } from './create-day-log.use-case';
import { DAY_LOG_REPOSITORY } from '../../domain/interfaces/repositories/day-log.repository.interface';
import { DayLogValidator } from '../validators/day-log.validator';
import { WorkoutSessionService } from '../../../workout-session/workout-session.service';
import { DayLogDomain } from '../../domain/entities/day-log.domain';

describe('CreateDayLogUseCase', () => {
  let useCase: CreateDayLogUseCase;

  const mockRepository = {
    findActive: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
  };

  const mockValidator = {
    validateCreation: jest.fn(),
    validateNoActiveWeek: jest.fn(),
  };

  const mockWorkoutSessionService = {
    create: jest.fn(),
  };

  const mockUserId = '507f1f77bcf86cd799439011';

  const validInput = {
    date: '2024-01-01',
    timezone: 'America/Argentina/Buenos_Aires',
    planId: '507f1f77bcf86cd799439013',
    notes: 'New day',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateDayLogUseCase,
        { provide: DAY_LOG_REPOSITORY, useValue: mockRepository },
        { provide: DayLogValidator, useValue: mockValidator },
        { provide: WorkoutSessionService, useValue: mockWorkoutSessionService },
      ],
    }).compile();

    useCase = module.get<CreateDayLogUseCase>(CreateDayLogUseCase);
  });

  describe('execute', () => {
    it('should throw error if date is not in yyyy-MM-dd format', async () => {
      await expect(
        useCase.execute({ ...validInput, date: '01-01-2024' }, mockUserId),
      ).rejects.toThrow('must be in yyyy-MM-dd format');
    });

    it('should validate creation (no active day log)', async () => {
      mockRepository.findActive.mockResolvedValue(null);
      mockValidator.validateCreation.mockResolvedValue(undefined);

      const createdDomain = new DayLogDomain(
        '507f1f77bcf86cd799439014',
        mockUserId,
        new Date('2024-01-01T03:00:00.000Z'),
        validInput.planId,
        null,
        null,
        [],
        'pending',
        true,
        false,
        validInput.notes,
      );

      mockRepository.create.mockResolvedValue(createdDomain);
      mockRepository.findOne.mockResolvedValue(createdDomain);

      const result = await useCase.execute(validInput, mockUserId);

      expect(mockValidator.validateCreation).toHaveBeenCalledWith(
        '2024-01-01',
        false,
      );
      expect(mockRepository.create).toHaveBeenCalled();
      expect(result).toEqual(createdDomain);
    });

    it('should create a WorkoutSession when routineDayId is provided', async () => {
      mockRepository.findActive.mockResolvedValue(null);
      mockValidator.validateCreation.mockResolvedValue(undefined);

      mockWorkoutSessionService.create.mockResolvedValue({
        _id: '507f1f77bcf86cd799439015',
      });

      const createdDomain = new DayLogDomain(
        '507f1f77bcf86cd799439014',
        mockUserId,
        new Date('2024-01-01T03:00:00.000Z'),
        null,
        '507f1f77bcf86cd799439016',
        '507f1f77bcf86cd799439015',
        [],
        'pending',
        true,
        false,
      );

      mockRepository.create.mockResolvedValue(createdDomain);
      mockRepository.findOne.mockResolvedValue(createdDomain);

      const result = await useCase.execute(
        {
          date: '2024-01-01',
          timezone: 'America/Argentina/Buenos_Aires',
          routineDayId: '507f1f77bcf86cd799439016',
        },
        mockUserId,
      );

      expect(mockWorkoutSessionService.create).toHaveBeenCalled();
      expect(result).toEqual(createdDomain);
    });
  });
});
