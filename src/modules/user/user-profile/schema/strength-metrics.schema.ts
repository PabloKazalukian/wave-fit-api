import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum CoreExercise {
  SQUAT = 'squat',
  BENCH_PRESS = 'bench_press',
  DEADLIFT = 'deadlift',
  OVERHEAD_PRESS = 'overhead_press',
  BARBELL_ROW = 'barbell_row',
  PULL_UP = 'pull_up',
  HIP_THRUST = 'hip_thrust',
  ROMANIAN_DEADLIFT = 'romanian_deadlift',
  INCLINE_BENCH = 'incline_bench',
  DUMBBELL_CURL = 'dumbbell_curl',
}

export enum ConfidenceLevel {
  TESTED = 'tested', // Máximo real probado
  ESTIMATED = 'estimated', // Calculado via fórmula (Epley, Brzycki)
  SELF_REPORTED = 'self_reported', // El usuario lo declaró
}

// Sub-documento: el set de referencia para estimar 1RM
@Schema({ _id: false })
class RepsAtWeight {
  @Prop({ required: true, type: Number })
  weightKg: number;

  @Prop({ required: true, type: Number, min: 1, max: 30 })
  reps: number;
}

const RepsAtWeightSchema = SchemaFactory.createForClass(RepsAtWeight);

@Schema({ timestamps: true })
export class UserStrengthMetric extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  // Permite ejercicios del enum o nombres custom (ej: "leg press", "cable fly")
  @Prop({ required: true, type: String, trim: true })
  exerciseKey: string;

  // 1RM calculado o medido en kg (siempre almacenamos en kg, convertimos al mostrar)
  @Prop({ required: true, type: Number, min: 0 })
  oneRmKg: number;

  // Set de referencia usado para calcular el 1RM vía Epley: 1RM = w * (1 + r/30)
  @Prop({ type: RepsAtWeightSchema, default: null })
  repsAtWeight?: RepsAtWeight;

  @Prop({
    required: true,
    enum: ConfidenceLevel,
    default: ConfidenceLevel.SELF_REPORTED,
  })
  confidenceLevel: ConfidenceLevel;

  // Fecha de la medición (puede diferir de createdAt si el usuario carga datos pasados)
  @Prop({ required: true, type: Date, default: () => new Date() })
  measuredAt: Date;

  // Notas opcionales: "con cinturón", "pausa en el pecho", etc.
  @Prop({ type: String, trim: true, default: null })
  notes?: string;
}

export const UserStrengthMetricSchema =
  SchemaFactory.createForClass(UserStrengthMetric);

// Índice compuesto: el plan necesita el 1RM más reciente por ejercicio
UserStrengthMetricSchema.index({ userId: 1, exerciseKey: 1, measuredAt: -1 });
