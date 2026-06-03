// exercise-performance.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { SetPerformance, SetPerformanceSchema } from './set-performance.schema';

@Schema({ _id: false })
export class ExercisePerformance {
  @Prop({ type: Types.ObjectId, required: true })
  exerciseId: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 0 })
  series: number;

  @Prop({ type: [SetPerformanceSchema], required: true })
  sets: SetPerformance[];

  @Prop({ type: String })
  notes?: string;
}

export const ExercisePerformanceSchema =
  SchemaFactory.createForClass(ExercisePerformance);

// export const ExercisePerformanceSchema =
//   SchemaFactory.createForClass(ExercisePerformance);
// export type ExercisePerformanceDocument = ExercisePerformance & Document;
