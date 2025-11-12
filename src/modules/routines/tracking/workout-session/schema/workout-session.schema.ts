import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  ExercisePerformance,
  ExercisePerformanceSchema,
} from './exercise-performance.schema';

@Schema({ timestamps: true })
export class WorkoutSession {
  @Prop({ type: Date, default: Date.now })
  date?: Date;

  @Prop({ type: Types.ObjectId, ref: 'RoutineDay', required: false })
  routineDayId?: string;

  @Prop({ type: [ExercisePerformanceSchema], default: [] })
  exercises?: ExercisePerformance[];

  @Prop({ type: String })
  notes?: string;
}

export type WorkoutSessionDocument = WorkoutSession & Document;
export const WorkoutSessionSchema =
  SchemaFactory.createForClass(WorkoutSession);
WorkoutSessionSchema.index({ userId: 1, date: 1 });
