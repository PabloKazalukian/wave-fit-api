import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  ExercisePerformance,
  ExercisePerformanceSchema,
} from './exercise-performance.schema';

export type StatusWorkoutSession = 'not_started' | 'complete';
export enum StatusWorkoutSessionEnum {
  NOT_STARTED = 'not_started',
  COMPLETE = 'complete',
}

@Schema({ timestamps: true })
export class WorkoutSession {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'WeekLog', required: true, index: true })
  weekLogId: Types.ObjectId;

  @Prop({ type: Date, required: true, index: true })
  date: Date;

  @Prop({ type: Types.ObjectId, ref: 'RoutineDay', default: null })
  routineDayId?: Types.ObjectId;

  @Prop({ type: [ExercisePerformanceSchema], default: [] })
  exercises: ExercisePerformance[];

  @Prop({ type: String, enum: StatusWorkoutSessionEnum, default: '' })
  status: StatusWorkoutSession;

  @Prop({ type: String, default: '' })
  notes?: string;
}

export type WorkoutSessionDocument = WorkoutSession & Document;
export const WorkoutSessionSchema =
  SchemaFactory.createForClass(WorkoutSession);
WorkoutSessionSchema.index({ userId: 1, date: 1 });
WorkoutSessionSchema.index({ userId: 1, routineDayId: 1 });
WorkoutSessionSchema.index({ weekLogId: 1 });
