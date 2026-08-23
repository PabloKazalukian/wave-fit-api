// modules/ai/ai-rate-limit.service.ts
import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AI_CAUSE } from './ai-error-causes';
import { AiUsage } from './schemas/ai-usage.schema';

const DEFAULT_DAILY_LIMIT = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AiRateLimitService {
  private readonly logger = new Logger(AiRateLimitService.name);

  constructor(
    @InjectModel(AiUsage.name)
    private readonly aiUsageModel: Model<AiUsage>,
  ) {}

  async assertWithinLimit(userId: string): Promise<void> {
    const limit = Number(process.env.AI_DAILY_LIMIT ?? DEFAULT_DAILY_LIMIT);
    const windowStart = this.currentWindowStart();

    let usage: AiUsage;
    try {
      usage = await this.incrementCount(userId, windowStart);
    } catch (error) {
      if (!this.isDuplicateKeyError(error)) throw error;
      // Carrera del primer insert concurrente (E11000): reintentar una vez
      this.logger.warn(
        `E11000 en upsert de ai_usage para userId=${userId}, reintentando una vez`,
      );
      usage = await this.incrementCount(userId, windowStart);
    }

    if (usage.count > limit) {
      throw new HttpException(
        {
          message: 'Límite diario de generaciones alcanzado',
          code: AI_CAUSE.RATE_LIMIT,
          limit,
          resetAt: new Date(windowStart.getTime() + DAY_MS),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private incrementCount(userId: string, windowStart: Date): Promise<AiUsage> {
    return this.aiUsageModel
      .findOneAndUpdate(
        { userId: new Types.ObjectId(userId), windowStart },
        { $inc: { count: 1 } },
        { upsert: true, new: true },
      )
      .exec();
  }

  private currentWindowStart(): Date {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: unknown }).code === 11000
    );
  }
}
