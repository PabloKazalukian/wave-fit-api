// modules/ai/ai.resolver.ts
import { Resolver, Query, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { AiRateLimitService } from './ai-rate-limit.service';
import { AiUsageStatusOutput } from './dto/ai-usage-status.output';

@Resolver()
@UseGuards(GqlAuthGuard)
export class AiResolver {
  constructor(private readonly rateLimitService: AiRateLimitService) {}

  @Query(() => AiUsageStatusOutput, {
    name: 'aiUsageStatus',
    description: 'Devuelve el uso diario de IA del usuario autenticado (sin modificar el contador)',
  })
  async aiUsageStatus(@Context() ctx: any): Promise<AiUsageStatusOutput> {
    const userId: string = ctx.req.user._id.toString();
    return this.rateLimitService.getUsage(userId);
  }
}
