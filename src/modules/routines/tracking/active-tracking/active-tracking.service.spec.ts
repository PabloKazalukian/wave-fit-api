import { Test, TestingModule } from '@nestjs/testing';
import { ActiveTrackingService } from './active-tracking.service';
import { WEEK_LOG_REPOSITORY } from '../week-log/domain/interfaces/repositories/week-log.repository.interface';
import { DAY_LOG_REPOSITORY } from '../day-log/domain/interfaces/repositories/day-log.repository.interface';
import { TrackingType } from './presentation/entities/active-tracking.entity';

describe('ActiveTrackingService', () => {
  let service: ActiveTrackingService;

  const mockWeekLogRepository = { findActive: jest.fn() };
  const mockDayLogRepository = { findActive: jest.fn() };

  const mockUserId = '507f1f77bcf86cd799439011';

  const mockWeek = { id: 'week1', userId: mockUserId };
  const mockDay = { id: 'day1', userId: mockUserId };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActiveTrackingService,
        { provide: WEEK_LOG_REPOSITORY, useValue: mockWeekLogRepository },
        { provide: DAY_LOG_REPOSITORY, useValue: mockDayLogRepository },
      ],
    }).compile();

    service = module.get<ActiveTrackingService>(ActiveTrackingService);
  });

  describe('hasActiveWeek', () => {
    it('should return true if there is an active week log', async () => {
      mockWeekLogRepository.findActive.mockResolvedValue(mockWeek);
      await expect(service.hasActiveWeek(mockUserId)).resolves.toBe(true);
    });

    it('should return false if there is no active week log', async () => {
      mockWeekLogRepository.findActive.mockResolvedValue(null);
      await expect(service.hasActiveWeek(mockUserId)).resolves.toBe(false);
    });
  });

  describe('hasActiveDay', () => {
    it('should return true if there is an active day log', async () => {
      mockDayLogRepository.findActive.mockResolvedValue(mockDay);
      await expect(service.hasActiveDay(mockUserId)).resolves.toBe(true);
    });

    it('should return false if there is no active day log', async () => {
      mockDayLogRepository.findActive.mockResolvedValue(null);
      await expect(service.hasActiveDay(mockUserId)).resolves.toBe(false);
    });
  });

  describe('hasActiveTracking', () => {
    it('should return true if week is active', async () => {
      mockWeekLogRepository.findActive.mockResolvedValue(mockWeek);
      mockDayLogRepository.findActive.mockResolvedValue(null);
      await expect(service.hasActiveTracking(mockUserId)).resolves.toBe(true);
    });

    it('should return true if day is active', async () => {
      mockWeekLogRepository.findActive.mockResolvedValue(null);
      mockDayLogRepository.findActive.mockResolvedValue(mockDay);
      await expect(service.hasActiveTracking(mockUserId)).resolves.toBe(true);
    });

    it('should return false if nothing is active', async () => {
      mockWeekLogRepository.findActive.mockResolvedValue(null);
      mockDayLogRepository.findActive.mockResolvedValue(null);
      await expect(service.hasActiveTracking(mockUserId)).resolves.toBe(false);
    });
  });

  describe('findActive (Fase D)', () => {
    it('should return WEEK_LOG type when week is active', async () => {
      mockWeekLogRepository.findActive.mockResolvedValue(mockWeek);
      mockDayLogRepository.findActive.mockResolvedValue(null);

      const result = await service.findActive(mockUserId);

      expect(result).toEqual({
        hasActive: true,
        type: TrackingType.WEEK_LOG,
        week: mockWeek,
      });
      expect(result.day).toBeUndefined();
    });

    it('should return DAY_LOG type when day is active', async () => {
      mockWeekLogRepository.findActive.mockResolvedValue(null);
      mockDayLogRepository.findActive.mockResolvedValue(mockDay);

      const result = await service.findActive(mockUserId);

      expect(result).toEqual({
        hasActive: true,
        type: TrackingType.DAY_LOG,
        day: mockDay,
      });
      expect(result.week).toBeUndefined();
    });

    it('should return hasActive false when nothing is active', async () => {
      mockWeekLogRepository.findActive.mockResolvedValue(null);
      mockDayLogRepository.findActive.mockResolvedValue(null);

      const result = await service.findActive(mockUserId);

      expect(result).toEqual({ hasActive: false });
    });
  });
});
