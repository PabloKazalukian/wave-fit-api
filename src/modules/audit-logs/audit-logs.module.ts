import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogsResolver } from './audit-logs.resolver';
import { AuditLog, AuditLogSchema } from './schema/audit-logs.schema';
import { AuditInterceptor } from './audit-logs.interceptor';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
  ],
  providers: [AuditLogsService, AuditLogsResolver, AuditInterceptor],
  exports: [AuditLogsService, AuditInterceptor], // Para usar en otros módulos
})
export class AuditLogsModule {}
