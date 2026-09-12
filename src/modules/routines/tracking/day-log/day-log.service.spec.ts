import { Test, TestingModule } from '@nestjs/testing';
import { DayLogService } from './day-log.service';
import { CreateDayLogInput } from './presentation/dto/create-day-log.input';
import { NotFoundException } from '@nestjs/common';
import {
  AssignRoutineDayUseCase,
  CreateDayLogUseCase,
  FindActiveDayLogUseCase,
  FindAllDayLogsUseCase,
  FindOneDayLogUseCase,
  RemoveDayLogUseCase,
  RemoveExtraSessionUseCase,
  RemoveWorkoutSessionUseCase,
  UpdateDayLogUseCase,
  UpdateDayStatusUseCase,
} from './application/use-cases';

describe('DayLogService', () => {
  let service: DayLogService;

  const mockCreateDayLogUseCase = { execute: jest.fn() };
  const mockFindAllDayLogsUseCase = { execute: jest.fn() };
  const mockFindOneDayLogUseCase = { execute: jest.fn() };
  const mockFindActiveDayLogUseCase = { execute: jest.fn() };
  const mockUpdateDayLogUseCase = { execute: jest.fn() };
  const mockUpdateDayStatusUseCase = { execute: jest.fn() };
  const mockRemoveDayLogUseCase = { execute: jest.fn() };
  const mockRemoveWorkoutSessionUseCase = { execute: jest.fn() };
  const mockRemoveExtraSessionUseCase = { execute: jest.fn() };
  const mockAssignRoutineDayUseCase = { execute: jest.fn() };

  const mockUserId = '507f1f77bcf86cd799439011';
  const mockDayLogId = '507f1f77bcf86cd799439012';

  const mockDayLog = {
    id: mockDayLogId,
    userId: mockUserId,
    date: new Date('2024-01-01T03:00:00.000Z'),
    planId: '507f1f77bcf86cd799439013',
    routineDayId: null,
    workoutSessionId: null,
    extraSessionIds: [],
    status: 'pending',
    active: true,
    completed: false,
    notes: 'Test day',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DayLogService,
        { provide: CreateDayLogUseCase, useValue: mockCreateDayLogUseCase },
        { provide: FindAllDayLogsUseCase, useValue: mockFindAllDayLogsUseCase },
        { provide: FindOneDayLogUseCase, useValue: mockFindOneDayLogUseCase },
        {
          provide: FindActiveDayLogUseCase,
          useValue: mockFindActiveDayLogUseCase,
        },
        { provide: UpdateDayLogUseCase, useValue: mockUpdateDayLogUseCase },
        {
          provide: UpdateDayStatusUseCase,
          useValue: mockUpdateDayStatusUseCase,
        },
        { provide: RemoveDayLogUseCase, useValue: mockRemoveDayLogUseCase },
        {
          provide: RemoveWorkoutSessionUseCase,
          useValue: mockRemoveWorkoutSessionUseCase,
        },
        {
          provide: RemoveExtraSessionUseCase,
          useValue: mockRemoveExtraSessionUseCase,
        },
        {
          provide: AssignRoutineDayUseCase,
          useValue: mockAssignRoutineDayUseCase,
        },
      ],
    }).compile();

    service = module.get<DayLogService>(DayLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new day log for authenticated user', async () => {
      const input: CreateDayLogInput = {
        date: '2024-01-01',
        timezone: 'America/Argentina/Buenos_Aires',
        planId: 'plan-id',
        notes: 'New day log',
      };

      mockCreateDayLogUseCase.execute.mockResolvedValue(mockDayLog);

      const result = await service.create(input, mockUserId);

      expect(mockCreateDayLogUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          date: input.date,
          timezone: input.timezone,
        }),
        mockUserId,
      );

      expect(result).toMatchObject({
        id: mockDayLogId,
        date: new Date('2024-01-01T03:00:00.000Z'),
      });
    });
  });

  describe('findAllByUser', () => {
    it('should return all day logs for authenticated user', async () => {
      const logs = [
        { id: mockDayLogId, userId: mockUserId },
        { id: '507f1f77bcf86cd799439014', userId: mockUserId },
      ];

      mockFindAllDayLogsUseCase.execute.mockResolvedValue(logs);

      const result = await service.findAllByUser(mockUserId);

      expect(mockFindAllDayLogsUseCase.execute).toHaveBeenCalledWith(
        mockUserId,
        5,
        0,
      );
      expect(result).toHaveLength(2);
    });

    it('should return empty array if user has no day logs', async () => {
      mockFindAllDayLogsUseCase.execute.mockResolvedValue([]);

      const result = await service.findAllByUser(mockUserId);

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a day log by id for the authenticated user', async () => {
      mockFindOneDayLogUseCase.execute.mockResolvedValue(mockDayLog);

      const result = await service.findOne(mockDayLogId, mockUserId);

      expect(mockFindOneDayLogUseCase.execute).toHaveBeenCalledWith(
        mockDayLogId,
        mockUserId,
      );
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if day log does not exist', async () => {
      mockFindOneDayLogUseCase.execute.mockResolvedValue(null);

      await expect(
        service.findOne(mockDayLogId, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findActiveDayLog', () => {
    it('should return the active day log for the authenticated user', async () => {
      mockFindActiveDayLogUseCase.execute.mockResolvedValue(mockDayLog);

      const result = await service.findActiveDayLog(mockUserId);

      expect(mockFindActiveDayLogUseCase.execute).toHaveBeenCalledWith(
        mockUserId,
      );
      expect(result).toBeDefined();
    });

    it('should return null if no active day log exists', async () => {
      mockFindActiveDayLogUseCase.execute.mockResolvedValue(null);

      const result = await service.findActiveDayLog(mockUserId);

      expect(result).toBeNull();
    });
  });
});
