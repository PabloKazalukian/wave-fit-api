// src/audit-logs/audit-logs.resolver.ts
import { Resolver, Query, Args } from '@nestjs/graphql';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogEntity } from './entities/audit-log.entity';
import { AuditLogFiltersInput } from './dto/audit-log.input';

@Resolver(() => AuditLogEntity)
export class AuditLogsResolver {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Query(() => [AuditLogEntity], { name: 'auditLogs' })
  async getAuditLogs(
    @Args('filters', { nullable: true }) filters?: AuditLogFiltersInput,
  ) {
    return this.auditLogsService.findAll(filters);
  }

  @Query(() => [AuditLogEntity], { name: 'userAuditLogs' })
  async getUserAuditLogs(
    @Args('userId') userId: string,
    @Args('limit', { nullable: true, defaultValue: 50 }) limit?: number,
  ) {
    return this.auditLogsService.findByUser(userId, limit);
  }
}
