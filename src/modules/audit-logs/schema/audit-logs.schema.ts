// src/audit-logs/schemas/audit-log.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ collection: 'audit_logs', timestamps: true })
export class AuditLog extends Document {
  @Prop({ required: true, index: true })
  action: string; // 'CREATE_WEEKLY_ROUTINE'

  @Prop({ required: true, index: true })
  entity: string; // 'WeeklyRoutine'

  @Prop({ type: Types.ObjectId, index: true })
  entityId: Types.ObjectId; // ID de la rutina creada

  @Prop({ type: Types.ObjectId, index: true })
  userId?: Types.ObjectId; // Usuario que ejecutó la acción

  @Prop()
  userEmail: string;

  @Prop({ required: true })
  success: boolean; // true o false

  @Prop()
  errorMessage?: string; // Si falló, el mensaje

  @Prop({ type: Object })
  metadata: Record<string, any>; // Datos extra (IP, nombre rutina, etc)

  @Prop()
  ip?: string;

  @Prop({ type: Date, default: Date.now })
  timestamp: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

// Índice compuesto para consultas frecuentes
AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ entity: 1, action: 1, timestamp: -1 });
