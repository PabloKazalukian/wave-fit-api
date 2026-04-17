import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
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
  @Prop({ type: String, required: true })
  userId: string;

  @Prop({ type: String, default: null })
  weekLogId: string | null;

  @Prop({ type: Date, required: true })
  date: Date;

  @Prop({ type: String })
  routineDayId?: string;

  @Prop({ type: [ExercisePerformanceSchema], required: true })
  exercises: ExercisePerformance[];

  @Prop({ type: String, required: true })
  status: string;

  @Prop({ type: String })
  notes?: string;

  @Prop({ type: Boolean, default: false })
  edited: boolean;

  @Prop({ type: Boolean, default: false })
  deleted: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export type WorkoutSessionDocument = WorkoutSession & Document;
export const WorkoutSessionSchema =
  SchemaFactory.createForClass(WorkoutSession);
WorkoutSessionSchema.index({ userId: 1, date: 1 });
WorkoutSessionSchema.index({ userId: 1, routineDayId: 1 });
WorkoutSessionSchema.index({ weekLogId: 1 });
