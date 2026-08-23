import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AiRateLimitService } from './ai-rate-limit.service';
import { AiUsage } from './schemas/ai-usage.schema';
import { AI_CAUSE } from './ai-error-causes';

describe('AiRateLimitService', () => {
  let service: AiRateLimitService;

  const USER_ID = '507f1f77bcf86cd799439011';
  const DAY_MS = 24 * 60 * 60 * 1000;

  const execMock = jest.fn();
  const findOneAndUpdateMock = jest.fn(() => ({ exec: execMock }));
  const modelMock = { findOneAndUpdate: findOneAndUpdateMock };

  const expectedWindowStart = () => {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  };

  beforeAll(() => {
    process.env.AI_DAILY_LIMIT = '3';
  });

  afterAll(() => {
    delete process.env.AI_DAILY_LIMIT;
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiRateLimitService,
        { provide: getModelToken(AiUsage.name), useValue: modelMock },
      ],
    }).compile();

    service = module.get<AiRateLimitService>(AiRateLimitService);
  });

  describe('assertWithinLimit', () => {
    it('hace upsert con $inc sobre la ventana UTC del día y no lanza si count <= límite', async () => {
      execMock.mockResolvedValue({
        userId: new Types.ObjectId(USER_ID),
        windowStart: expectedWindowStart(),
        count: 2,
      });

      await expect(
        service.assertWithinLimit(USER_ID),
      ).resolves.toBeUndefined();

      expect(findOneAndUpdateMock).toHaveBeenCalledWith(
        {
          userId: new Types.ObjectId(USER_ID),
          windowStart: expectedWindowStart(),
        },
        { $inc: { count: 1 } },
        { upsert: true, new: true },
      );
    });

    it('lanza HttpException 429 con RATE_LIMIT_EXCEEDED cuando count supera el límite', async () => {
      execMock.mockResolvedValue({ count: 4 });

      let caught: unknown;
      try {
        await service.assertWithinLimit(USER_ID);
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(HttpException);
      const httpError = caught as HttpException;
      expect(httpError.getStatus()).toBe(429);

      const response = httpError.getResponse() as Record<string, any>;
      expect(response.code).toBe(AI_CAUSE.RATE_LIMIT);
      expect(response.message).toContain('Límite diario');
      expect(response.limit).toBe(3);
      expect(response.resetAt).toEqual(
        new Date(expectedWindowStart().getTime() + DAY_MS),
      );
    });

    it('reintenta una vez ante E11000 por carrera en el primer insert y tiene éxito', async () => {
      execMock
        .mockRejectedValueOnce({ code: 11000, message: 'E11000 duplicate key' })
        .mockResolvedValueOnce({ count: 1 });

      await expect(
        service.assertWithinLimit(USER_ID),
      ).resolves.toBeUndefined();
      expect(findOneAndUpdateMock).toHaveBeenCalledTimes(2);
    });

    it('propaga el error si el reintento tras E11000 vuelve a fallar', async () => {
      const dupError = { code: 11000, message: 'E11000 duplicate key' };
      execMock.mockRejectedValue(dupError);

      await expect(service.assertWithinLimit(USER_ID)).rejects.toBe(dupError);
      expect(findOneAndUpdateMock).toHaveBeenCalledTimes(2);
    });

    it('no reintenta ante errores que no son E11000', async () => {
      const boom = new Error('connection refused');
      execMock.mockRejectedValue(boom);

      await expect(service.assertWithinLimit(USER_ID)).rejects.toBe(boom);
      expect(findOneAndUpdateMock).toHaveBeenCalledTimes(1);
    });
  });
});
