import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class ExtraSession {
  @Prop({ required: true })
  type: string; // "cardio", "yoga", etc.

  @Prop({ type: Date, required: true })
  date: Date;

  @Prop({ required: true })
  discipline: string; // "running", "bicicleta", etc.

  @Prop({ type: Number, required: true })
  duration: number; // minutos

  @Prop({ type: Number, required: true, min: 1, max: 5 })
  intensityLevel: number; // escala 1–5

  @Prop({ type: Number, default: null })
  calories?: number;

  @Prop({ type: String, default: '' })
  notes?: string;
}

export type ExtraSessionDocument = ExtraSession & Document;
export const ExtraSessionSchema = SchemaFactory.createForClass(ExtraSession);
