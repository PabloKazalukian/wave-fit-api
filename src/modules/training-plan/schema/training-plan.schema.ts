import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { AiSnapshot, AiSnapshotSchema } from './ai-snapshot.schema';

export enum PlanStatus {
  DRAFT = 'draft', // generado pero no activado
  ACTIVE = 'active', // en curso
  COMPLETED = 'completed', // finalizado correctamente
  ABANDONED = 'abandoned', // el usuario lo descartó
  ARCHIVED = 'archived', // histórico visible pero inactivo
}

export enum PlanFocus {
  HYPERTROPHY = 'hypertrophy',
  STRENGTH = 'strength',
  ENDURANCE = 'endurance',
  FAT_LOSS = 'fat_loss',
  RECOMP = 'recomp',
  MAINTENANCE = 'maintenance',
  SPORT_SPECIFIC = 'sport_specific',
}

@Schema({ timestamps: true })
export class TrainingPlan extends Document {
  // ── Relaciones ───────────────────────────────────────────────────────────
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'UserProfile', required: true })
  userProfileId: Types.ObjectId;

  // El objetivo activo en el momento de generar el plan
  @Prop({ type: Types.ObjectId, ref: 'UserGoal', required: true })
  goalId: Types.ObjectId;

  // ── Metadata del plan ────────────────────────────────────────────────────
  @Prop({ type: String, required: true, trim: true })
  title: string; // "Plan Hipertrofia – Junio 2025"

  @Prop({ type: String, trim: true, default: null })
  description?: string;

  @Prop({ required: true, enum: PlanFocus })
  focus: PlanFocus;

  @Prop({ enum: PlanStatus, default: PlanStatus.DRAFT, index: true })
  status: PlanStatus;

  // ── Fechas ───────────────────────────────────────────────────────────────
  @Prop({ type: Date, required: true })
  startDate: Date;

  @Prop({ type: Date, required: true })
  endDate: Date;

  // Duración en semanas (derivado de startDate/endDate, pero guardado explícito)
  @Prop({ type: Number, required: true, min: 1, max: 52 })
  durationWeeks: number;

  // Días de entrenamiento por semana (ej: 3, 4, 5)
  @Prop({ type: Number, required: true, min: 1, max: 7 })
  trainingDaysPerWeek: number;

  // ── Snapshot IA ──────────────────────────────────────────────────────────
  // Qué se envió y qué respondió la IA en el momento de crear el plan
  @Prop({ type: AiSnapshotSchema, required: true })
  aiSnapshot: AiSnapshot;

  // ── WeekLogs (referencia, no embebido — pueden crecer mucho) ─────────────
  // Se accede via WeekLog.planId — no se guarda array aquí para evitar
  // documentos enormes. Usar populate o lookups según necesidad.

  // ── Progreso global ──────────────────────────────────────────────────────
  @Prop({ type: Number, default: 0, min: 0, max: 100 })
  overallAdherencePercent: number;

  @Prop({ type: Number, default: 0 })
  totalSessionsCompleted: number;

  @Prop({ type: Number, default: 0 })
  totalSessionsPlanned: number;

  // ── Versioning ───────────────────────────────────────────────────────────
  // Si el usuario regenera el plan, el anterior queda en historial
  // y este apunta al que lo reemplazó
  @Prop({ type: Types.ObjectId, ref: 'TrainingPlan', default: null })
  replacedByPlanId?: Types.ObjectId;

  @Prop({ type: Number, default: 1 })
  version: number;

  // Etiquetas libres para filtrar en el historial
  @Prop({ type: [String], default: [] })
  tags: string[];
}

export const TrainingPlanSchema = SchemaFactory.createForClass(TrainingPlan);

// Índices compuestos útiles
TrainingPlanSchema.index({ userId: 1, status: 1 });
TrainingPlanSchema.index({ userId: 1, createdAt: -1 }); // historial ordenado
TrainingPlanSchema.index({ userId: 1, goalId: 1 });
