import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class UserStrengthMetric extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true })
  exerciseKey: string;

  @Prop({ type: Number, required: true, min: 0 })
  oneRmKg: number;

  @Prop({
    type: {
      weightKg: { type: Number, required: true },
      reps: { type: Number, required: true },
    },
    default: null,
  })
  repsAtWeight?: { weightKg: number; reps: number };

  @Prop({
    type: String,
    enum: ['tested', 'estimated', 'self_reported'],
    default: 'estimated',
  })
  confidenceLevel: string;

  @Prop({ type: Date, required: true })
  measuredAt: Date;

  @Prop({ type: String, default: '' })
  notes?: string;
}

export type UserStrengthMetricDocument = UserStrengthMetric & Document;
export const UserStrengthMetricSchema = SchemaFactory.createForClass(UserStrengthMetric);

UserStrengthMetricSchema.index({ userId: 1, exerciseKey: 1 });
