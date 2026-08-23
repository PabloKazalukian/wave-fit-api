// src/modules/audit-logs/audit-logs.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { AuditLogsService } from './audit-logs.service';

export const AUDIT_METADATA_KEY = 'audit';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private reflector: Reflector,
    private auditService: AuditLogsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditMetadata = this.reflector.get<{
      action: string;
      entity: string;
    }>(AUDIT_METADATA_KEY, context.getHandler());

    if (!auditMetadata) {
      return next.handle();
    }

    // Extraer contexto de GraphQL
    const gqlContext = GqlExecutionContext.create(context);
    const ctx = gqlContext.getContext();

    // 🔍 Intentar obtener el usuario de múltiples fuentes
    const user = this.extractUser(ctx);

    // 🔍 Obtener IP
    const ip = this.extractIp(ctx);

    // 📊 Log de debug para ver qué estamos recibiendo
    this.logger.debug(
      `Auditing ${auditMetadata.action} - User: ${user?.id || 'anonymous'}`,
    );

    return next.handle().pipe(
      tap((result) => {
        // ✅ Operación EXITOSA
        this.auditService.logAsync({
          action: auditMetadata.action,
          entity: auditMetadata.entity,
          entityId: this.extractEntityId(result),
          userId: user?.id || user?._id?.toString() || 'anonymous',
          userEmail: user?.email,
          success: true,
          metadata: {
            resultType: result?.constructor?.name,
            hasUser: !!user,
            timestamp: new Date(),
          },
          ip,
        });
      }),
      catchError((error) => {
        // ❌ Operación FALLÓ
        this.auditService.logAsync({
          action: auditMetadata.action,
          entity: auditMetadata.entity,
          userId: user?.id || user?._id?.toString() || 'anonymous',
          userEmail: user?.email,
          success: false,
          errorMessage: error.message,
          metadata: {
            errorStack: error.stack,
            hasUser: !!user,
            timestamp: new Date(),
          },
          ip,
        });

        return throwError(() => error);
      }),
    );
  }

  /**
   * Extrae el usuario del contexto de GraphQL
   * Intenta múltiples fuentes comunes
   */
  private extractUser(ctx: any): any {
    // Opción 1: ctx.req.user (más común con Passport)
    if (ctx?.req?.user) {
      return ctx.req.user;
    }

    // Opción 2: Directamente en ctx.user
    if (ctx?.user) {
      return ctx.user;
    }

    // Opción 3: En headers o payload custom
    if (ctx?.req?.headers?.['x-user-id']) {
      return {
        id: ctx.req.headers['x-user-id'],
        email: ctx.req.headers['x-user-email'],
      };
    }

    // Si no hay usuario, retornar null
    return null;
  }

  /**
   * Extrae la IP del request
   */
  private extractIp(ctx: any): string | undefined {
    const req = ctx?.req;
    if (!req) return undefined;

    return (
      req.headers?.['x-forwarded-for']?.split(',')[0] ||
      req.headers?.['x-real-ip'] ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      req.ip
    );
  }

  /**
   * Extrae el ID de la entidad del resultado
   */
  private extractEntityId(result: any): string | undefined {
    if (!result) return undefined;

    return result._id?.toString() || result.id?.toString() || undefined;
  }
}
