import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class ExtraSession {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'WorkoutSession', required: true })
  workoutSessionId: Types.ObjectId;

  @Prop({ type: String, required: true })
  type: string;

  @Prop({ type: Date, required: true, index: true })
  date: Date;

  @Prop({ type: String, required: true })
  discipline: string;

  @Prop({ type: Number, required: true })
  duration: number;

  @Prop({ type: Number, required: true, min: 1, max: 5 })
  intensityLevel: number;

  @Prop({ type: Number, default: null })
  calories?: number;

  @Prop({ type: String, default: '' })
  notes?: string;
}

export type ExtraSessionDocument = ExtraSession & Document;
export const ExtraSessionSchema = SchemaFactory.createForClass(ExtraSession);

ExtraSessionSchema.index({ userId: 1, date: 1 });
ExtraSessionSchema.index({ workoutSessionId: 1 });
