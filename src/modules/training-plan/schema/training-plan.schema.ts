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

// Objetivo principal del plan. Debe coincidir con los valores de
// PrimaryGoal del goals.schema del perfil de usuario, ya que la IA
// lo deriva de goal.primary. Ambos conjuntos se mantienen idénticos.
export enum PlanFocus {
  FAT_LOSS = 'fat_loss', // Pérdida de grasa / déficit calórico
  MUSCLE_GAIN = 'muscle_gain', // Hipertrofia / ganancia muscular
  STRENGTH = 'strength', // Fuerza máxima
  ENDURANCE = 'endurance', // Resistencia muscular/cardiovascular
  MAINTENANCE = 'maintenance', // Mantenimiento del estado actual
  RECOMP = 'recomp', // Recomposición corporal (bajar grasa + ganar músculo)
}

@Schema({ timestamps: true })
export class TrainingPlan extends Document {
  // ── Relaciones ───────────────────────────────────────────────────────────
  // Usuario dueño del plan (clave para el scope de todas las queries)
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  // Perfil de usuario usado para generar el plan (edad, peso, equipo, etc.)
  @Prop({ type: Types.ObjectId, ref: 'UserProfile', required: true })
  userProfileId: Types.ObjectId;

  // Snapshot del objetivo del usuario en el momento de generar el plan (auditoría)
  @Prop({ type: Types.ObjectId, ref: 'Goal', required: true })
  goalId: Types.ObjectId;

  // ── Metadata del plan ────────────────────────────────────────────────────
  // Nombre visible del plan, ej: "Plan Hipertrofia – Junio 2025"
  @Prop({ type: String, required: true, trim: true })
  title: string;

  // Descripción libre opcional del plan
  @Prop({ type: String, trim: true, default: null })
  description?: string;

  // Objetivo principal (enum PlanFocus, alineado con PrimaryGoal del perfil)
  @Prop({ required: true, enum: PlanFocus })
  focus: PlanFocus;

  // Estado del ciclo de vida: draft → active → completed/abandoned/archived
  @Prop({ enum: PlanStatus, default: PlanStatus.DRAFT, index: true })
  status: PlanStatus;

  // ── Fechas ───────────────────────────────────────────────────────────────
  // Primer día del plan (hoy en UTC al generar)
  @Prop({ type: Date, required: true })
  startDate: Date;

  // Último día del plan (startDate + durationWeeks * 7)
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
  // Porcentaje de adherencia (sesiones completadas / planeadas), 0-100
  @Prop({ type: Number, default: 0, min: 0, max: 100 })
  overallAdherencePercent: number;

  // Sesiones de entrenamiento completadas hasta el momento
  @Prop({ type: Number, default: 0 })
  totalSessionsCompleted: number;

  // Sesiones totales programadas en el plan
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

  // ── Confirmación ────────────────────────────────────────────────────────
  // true = plan confirmado por el usuario, listo para activar/tracking
  @Prop({ type: Boolean, default: false })
  confirmed: boolean;

  // ── Timestamps (declarados explícitamente para tipado TS con timestamps: true) ──
  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const TrainingPlanSchema = SchemaFactory.createForClass(TrainingPlan);

// Índices compuestos útiles
TrainingPlanSchema.index({ userId: 1, status: 1 });
TrainingPlanSchema.index({ userId: 1, createdAt: -1 }); // historial ordenado
TrainingPlanSchema.index({ userId: 1, goalId: 1 });
