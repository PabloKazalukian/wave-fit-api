import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Goal extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Object, required: true })
  contextSnapshot: Record<string, any>;

  @Prop({ type: Date, default: () => new Date() })
  capturedAt: Date;
}

export const GoalSchema = SchemaFactory.createForClass(Goal);

GoalSchema.index({ userId: 1, capturedAt: -1 });
