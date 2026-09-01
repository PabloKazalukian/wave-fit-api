import { Resolver, Query, Context } from '@nestjs/graphql';
import { UseGuards, UseInterceptors } from '@nestjs/common';
import { GqlAuthGuard } from 'src/modules/auth/guards/gql-auth.guard';
import { AuditInterceptor } from 'src/modules/audit-logs/audit-logs.interceptor';
import { extractUserId } from 'src/common/utils/user-id.utils';
import { ActiveTrackingService } from './active-tracking.service';
import { ActiveTracking } from './presentation/entities/active-tracking.entity';

@Resolver(() => ActiveTracking)
@UseGuards(GqlAuthGuard)
@UseInterceptors(AuditInterceptor)
export class ActiveTrackingResolver {
  constructor(
    private readonly activeTrackingService: ActiveTrackingService,
  ) {}

  @Query(() => ActiveTracking, { name: 'activeTracking' })
  async activeTracking(@Context() context): Promise<ActiveTracking> {
    const userId = extractUserId(context);
    return this.activeTrackingService.findActive(userId);
  }
}
