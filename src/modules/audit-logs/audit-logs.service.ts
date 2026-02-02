// src/audit-logs/audit-logs.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog } from './schema/audit-logs.schema';
import { AuditLogFiltersInput } from './dto/audit-log.input';

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(
    @InjectModel(AuditLog.name) private auditModel: Model<AuditLog>,
  ) {}

  /**
   * 🔥 Fire-and-forget: NO bloquea la operación principal
   */
  logAsync(data: {
    action: string;
    entity: string;
    entityId?: string;
    userId: string;
    userEmail?: string;
    success: boolean;
    errorMessage?: string;
    metadata?: any;
    ip?: string;
  }): void {
    // No usamos await - se ejecuta en paralelo
    this.auditModel
      .create({
        ...data,
        timestamp: new Date(),
      })
      .catch((err) => {
        // Si falla el log, solo lo reportamos internamente
        this.logger.error(
          `❌ Failed to save audit log: ${err.message}`,
          err.stack,
        );
      });
  }

  /**
   * Consultar todos los logs con filtros opcionales
   */
  async findAll(filters?: AuditLogFiltersInput): Promise<AuditLog[]> {
    const query: any = {};

    if (filters?.userId) query.userId = filters.userId;
    if (filters?.entity) query.entity = filters.entity;
    if (filters?.action) query.action = filters.action;
    if (filters?.success !== undefined) query.success = filters.success;

    if (filters?.startDate || filters?.endDate) {
      query.timestamp = {};
      if (filters.startDate) query.timestamp.$gte = filters.startDate;
      if (filters.endDate) query.timestamp.$lte = filters.endDate;
    }

    return this.auditModel
      .find(query)
      .sort({ timestamp: -1 }) // Más recientes primero
      .limit(100) // Límite por seguridad
      .exec();
  }

  /**
   * Logs de un usuario específico
   */
  async findByUser(userId: string, limit = 50): Promise<AuditLog[]> {
    return this.auditModel
      .find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
  }
}
