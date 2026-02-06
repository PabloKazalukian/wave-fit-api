import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  ExtraSession,
  ExtraSessionSchema,
} from '../../extra-session/schema/extra-session.schema';
import {
  WorkoutSession,
  WorkoutSessionSchema,
} from '../../workout-session/schema/workout-session.schema';

@Schema({ timestamps: true })
export class WeekLog {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Date, required: true, index: true })
  startDate: Date;

  @Prop({ type: Date, required: true })
  endDate: Date;

  @Prop({ type: Types.ObjectId, ref: 'RoutinePlan', default: null })
  planId?: Types.ObjectId;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'WorkoutSession' }],
    default: [],
  })
  workoutSessionIds: Types.ObjectId[];

  @Prop({ type: Boolean, default: false, index: true })
  completed: boolean;

  @Prop({ type: String, default: '' })
  notes?: string;
}

export const WeekLogSchema = SchemaFactory.createForClass(WeekLog);
WeekLogSchema.index({ userId: 1, startDate: 1 }, { unique: true });
WeekLogSchema.index({ userId: 1, completed: 1 });
