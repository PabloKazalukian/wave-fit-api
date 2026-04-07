import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ExtraSessionCategory } from '../extra-session.catalog';
import type { ExtraSessionDisciplineKey } from '../extra-session.catalog';

@Schema({ timestamps: true })
export class ExtraSession {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'WorkoutSession',
    required: true,
    index: true,
  })
  workoutSessionId: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(ExtraSessionCategory),
  })
  category: ExtraSessionCategory;

  // 🔥 clave del catálogo (source of truth)
  @Prop({
    type: String,
    required: true,
    enum: [
      'running',
      'cycling',
      'stationary_bike',
      'swimming',
      'walking',
      'weightlifting',
      'crossfit',
      'football',
      'basketball',
      'tennis',
      'yoga',
      'pilates',
      'mobility',
    ],
  })
  discipline: ExtraSessionDisciplineKey;

  @Prop({
    type: Date,
    required: true,
    index: true,
  })
  date: Date;

  // minutos
  @Prop({
    type: Number,
    required: true,
    min: 1,
  })
  duration: number;

  // 1 - 5
  @Prop({
    type: Number,
    required: true,
    min: 1,
    max: 5,
  })
  intensityLevel: number;

  // 🔥 override manual (opcional)
  @Prop({
    type: Number,
    default: null,
  })
  calories?: number;

  @Prop({
    type: String,
    default: '',
  })
  notes?: string;
}

export type ExtraSessionDocument = ExtraSession & Document;

export const ExtraSessionSchema = SchemaFactory.createForClass(ExtraSession);

// 🔥 índices útiles reales
ExtraSessionSchema.index({ userId: 1, date: 1 });
ExtraSessionSchema.index({ workoutSessionId: 1 });
ExtraSessionSchema.index({ discipline: 1 });
