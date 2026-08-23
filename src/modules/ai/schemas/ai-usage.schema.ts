// modules/ai/schemas/ai-usage.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ collection: 'ai_usage', timestamps: true })
export class AiUsage extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Date, required: true })
  windowStart: Date;

  @Prop({ type: Number, default: 0 })
  count: number;
}

export const AiUsageSchema = SchemaFactory.createForClass(AiUsage);

// Una sola ventana por usuario y día UTC
AiUsageSchema.index({ userId: 1, windowStart: 1 }, { unique: true });

// Purga automática de ventanas viejas (> 2 días)
AiUsageSchema.index(
  { windowStart: 1 },
  { expireAfterSeconds: 2 * 24 * 60 * 60 },
);
