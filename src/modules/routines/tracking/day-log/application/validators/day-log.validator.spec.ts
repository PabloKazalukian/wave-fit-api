import { Test, TestingModule } from '@nestjs/testing';
import { DayLogValidator } from './day-log.validator';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { DayLogDomain } from '../../domain/entities/day-log.domain';
import { ActiveTrackingService } from '../../../active-tracking/active-tracking.service';

describe('DayLogValidator', () => {
  let validator: DayLogValidator;

  const mockActiveTrackingService = {
    hasActiveWeek: jest.fn(),
    hasActiveDay: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DayLogValidator,
        {
          provide: ActiveTrackingService,
          useValue: mockActiveTrackingService,
        },
      ],
    }).compile();

    validator = module.get<DayLogValidator>(DayLogValidator);
  });

  describe('validateCreation', () => {
    it('should pass when date is valid and no active day log', async () => {
      await expect(
        validator.validateCreation('2024-01-01', false),
      ).resolves.toBeUndefined();
    });

    it('should throw BadRequestException if date is not in yyyy-MM-dd format', async () => {
      await expect(
        validator.validateCreation('01-01-2024', false),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw ConflictException if there is already an active day log', async () => {
      await expect(
        validator.validateCreation('2024-01-01', true),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('validateNoActiveWeek', () => {
    it('should pass when no active week log exists', async () => {
      mockActiveTrackingService.hasActiveWeek.mockResolvedValue(false);

      await expect(
        validator.validateNoActiveWeek('user1'),
      ).resolves.toBeUndefined();
    });

    it('should throw ConflictException if there is an active week log', async () => {
      mockActiveTrackingService.hasActiveWeek.mockResolvedValue(true);

      await expect(
        validator.validateNoActiveWeek('user1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('validateOwnership', () => {
    it('should throw ForbiddenException if day log does not belong to user', () => {
      const dayLog = new DayLogDomain(
        'id1',
        'user1',
        new Date(),
        null,
        null,
        null,
        [],
        'pending',
        true,
        false,
      );
      expect(() => validator.validateOwnership(dayLog, 'user2')).toThrow(
        ForbiddenException,
      );
    });

    it('should pass when day log belongs to user', () => {
      const dayLog = new DayLogDomain(
        'id1',
        'user1',
        new Date(),
        null,
        null,
        null,
        [],
        'pending',
        true,
        false,
      );
      expect(() => validator.validateOwnership(dayLog, 'user1')).not.toThrow();
    });
  });

  describe('validateOwnershipModel', () => {
    it('should throw ForbiddenException if model does not belong to user', () => {
      expect(() =>
        validator.validateOwnershipModel({ userId: 'user1' }, 'user2'),
      ).toThrow(ForbiddenException);
    });

    it('should pass when model belongs to user', () => {
      expect(() =>
        validator.validateOwnershipModel({ userId: 'user1' }, 'user1'),
      ).not.toThrow();
    });
  });
});
