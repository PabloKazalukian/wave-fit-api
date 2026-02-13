import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false }) // No genera un ObjectId propio porque es subdocumento
export class ExercisePerformance {
  @Prop({ type: String, required: true })
  exerciseId: string; // referencia al Exercise

  @Prop({ type: Number })
  series: number;

  @Prop({ type: [Object], required: true })
  sets: {
    reps: number;
    weights?: number;
  }[];

  @Prop({ type: String })
  notes?: string;
}

export const ExercisePerformanceSchema =
  SchemaFactory.createForClass(ExercisePerformance);
export type ExercisePerformanceDocument = ExercisePerformance & Document;
