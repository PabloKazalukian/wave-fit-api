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
export class WeekLog extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: string;

  @Prop({ type: Date, required: true })
  startDate: Date;

  @Prop({ type: Date, required: true })
  endDate: Date;

  @Prop({ type: [WorkoutSessionSchema], default: [] })
  workouts?: WorkoutSession[];

  @Prop({ type: [ExtraSessionSchema], default: [] })
  extras?: ExtraSession[];

  @Prop({ type: Types.ObjectId, ref: 'RoutinePlan', default: null })
  planId?: string;

  @Prop({ type: String, default: '' })
  notes?: string;

  @Prop({ type: Boolean, default: false })
  completed: boolean;
}

export const WeekLogSchema = SchemaFactory.createForClass(WeekLog);
