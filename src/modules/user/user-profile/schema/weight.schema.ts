import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

// Tabla separada de user_profile para trackear evolución del peso en el tiempo.
// user_profile.weightKg siempre es el peso actual; esta colección es el historial.
@Schema({ timestamps: true })
export class WeightLog extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, type: Number, min: 20, max: 500 })
  weightKg: number;

  @Prop({ type: Number, min: 1, max: 70, default: null })
  bodyFatPct?: number;

  @Prop({ required: true, type: Date, default: () => new Date() })
  loggedAt: Date;

  @Prop({ type: String, trim: true, default: null })
  notes?: string;
}

export const WeightLogSchema = SchemaFactory.createForClass(WeightLog);

WeightLogSchema.index({ userId: 1, loggedAt: -1 });
