import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  ExercisePerformance,
  ExercisePerformanceSchema,
} from '../../../routines/tracking/workout-session/schema/exercise-performance.schema';

@Schema({ timestamps: true })
export class WorkoutSession extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'WeekLog', default: null })
  weekLogId: Types.ObjectId | null;

  @Prop({ type: Date, required: true })
  date: Date;

  @Prop({ type: Types.ObjectId, ref: 'RoutineDay' })
  routineDayId?: Types.ObjectId;

  @Prop({ type: [ExercisePerformanceSchema], required: true })
  exercises: ExercisePerformance[];

  @Prop({ type: String, required: true })
  status: string;

  @Prop({ type: Boolean, default: false })
  deleted: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export type WorkoutSessionDocument = WorkoutSession & Document;
export const WorkoutSessionSchema = SchemaFactory.createForClass(WorkoutSession);

WorkoutSessionSchema.index({ userId: 1, date: 1 });
WorkoutSessionSchema.index({ userId: 1, deleted: 1 });
