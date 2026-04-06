import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ _id: false })
class WeekLogDay {
  @Prop({ required: true })
  order: number; // 1–7

  @Prop({ required: true })
  date: Date;

  @Prop({ type: Boolean, default: false })
  isRest: boolean; // descanso planificado

  @Prop({ type: Types.ObjectId, ref: 'WorkoutSession', default: null })
  workoutSessionId?: Types.ObjectId | null;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'ExtraSession' }],
    default: [],
  })
  extraSessionIds: Types.ObjectId[];

  @Prop({
    type: String,
    enum: ['pending', 'complete', 'skipped'],
    default: 'pending',
  })
  status: string;
}

const WeekLogDaySchema = SchemaFactory.createForClass(WeekLogDay);

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
    type: [WeekLogDaySchema],
    validate: [(v: any[]) => v.length === 7, 'Week must contain 7 days'],
  })
  days: WeekLogDay[];

  @Prop({ type: Boolean, default: false, index: true })
  completed: boolean;

  @Prop({ type: Boolean, default: true, index: true })
  active: boolean;

  @Prop({ type: String, default: '' })
  notes?: string;
}

export const WeekLogSchema = SchemaFactory.createForClass(WeekLog);

WeekLogSchema.index({ userId: 1, startDate: 1 });
WeekLogSchema.index({ userId: 1, completed: 1 });
WeekLogSchema.index({ 'days.workoutSessionId': 1 });
WeekLogSchema.index({ 'days.extraSessionIds': 1 });
