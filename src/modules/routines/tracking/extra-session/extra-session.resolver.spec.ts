import { Test, TestingModule } from '@nestjs/testing';
import { ExtraSessionResolver } from './extra-session.resolver';
import { ExtraSessionService } from './extra-session.service';
import { Types } from 'mongoose';
import { BadRequestException } from '@nestjs/common';
import { EXTRA_SESSION_DISCIPLINES } from './extra-session.catalog';
import { AuditInterceptor } from 'src/modules/audit-logs/audit-logs.interceptor';

describe('ExtraSessionResolver', () => {
  let resolver: ExtraSessionResolver;
  let serviceMock: any;

  const mockUserId = new Types.ObjectId().toHexString();
  const mockContext = { req: { user: { id: mockUserId } } };
  const mockInvalidContext = { req: { user: { id: 'invalid_id' } } };

  beforeEach(async () => {
    serviceMock = {
      create: jest.fn(),
      findAllByUser: jest.fn(),
      findOne: jest.fn(),
      findByWorkoutSession: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExtraSessionResolver,
        { provide: ExtraSessionService, useValue: serviceMock },
      ],
    })
      .overrideInterceptor(AuditInterceptor)
      .useValue({
        intercept: jest.fn().mockImplementation((context, next) => next.handle()),
      })
      .compile();

    resolver = module.get<ExtraSessionResolver>(ExtraSessionResolver);
  });

  describe('getCatalog', () => {
    it('should return catalog values', () => {
      const result = resolver.getCatalog();
      expect(result).toEqual(Object.values(EXTRA_SESSION_DISCIPLINES));
    });
  });

  describe('createExtraSession', () => {
    it('should call service create', async () => {
      const input: any = {};
      await resolver.createExtraSession(input, mockContext);
      expect(serviceMock.create).toHaveBeenCalledWith(input, mockUserId);
    });
  });

  describe('findAll', () => {
    it('should return user sessions', async () => {
      serviceMock.findAllByUser.mockResolvedValue([]);
      const result = await resolver.findAll(mockContext);
      expect(result).toEqual([]);
      expect(serviceMock.findAllByUser).toHaveBeenCalledWith(mockUserId);
    });

    it('should throw BadRequestException if userId is invalid', async () => {
      expect(() => resolver.findAll(mockInvalidContext)).toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('should return one session', async () => {
      serviceMock.findOne.mockResolvedValue({});
      const result = await resolver.findOne('test_id', mockContext);
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException if userId is invalid', async () => {
      expect(() => resolver.findOne('test_id', mockInvalidContext)).toThrow(BadRequestException);
    });
  });

  describe('findByWorkoutSession', () => {
    it('should return sessions by workout session id', async () => {
      serviceMock.findByWorkoutSession.mockResolvedValue([]);
      const result = await resolver.findByWorkoutSession('test_id', mockContext);
      expect(result).toEqual([]);
    });

    it('should throw BadRequestException if userId is invalid', async () => {
      expect(() => resolver.findByWorkoutSession('test_id', mockInvalidContext)).toThrow(BadRequestException);
    });
  });

  describe('updateExtraSession', () => {
    it('should call service update', async () => {
      const input: any = { id: 'test_id' };
      await resolver.updateExtraSession(input, mockContext);
      expect(serviceMock.update).toHaveBeenCalledWith('test_id', input, mockUserId);
    });
  });

  describe('removeExtraSession', () => {
    it('should call service remove', async () => {
      await resolver.removeExtraSession('test_id', mockContext);
      expect(serviceMock.remove).toHaveBeenCalledWith('test_id', mockUserId);
    });
  });
});
