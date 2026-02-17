// set-performance.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class SetPerformance {
  @Prop({ type: Number, required: true, min: 0 })
  reps: number;

  @Prop({ type: Number, min: 0 })
  weights?: number;
}

export const SetPerformanceSchema =
  SchemaFactory.createForClass(SetPerformance);
