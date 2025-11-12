import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class RoutinePlan extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  // ejemplo: "6/7" (días activos/semana)
  @Prop({ required: false })
  weekly_distribution?: string;

  // Referencias a los días del plan
  @Prop({ type: [{ type: Types.ObjectId, ref: 'RoutineDay' }], default: [] })
  routineDays: Types.ObjectId[];

  // usuario creador del plan (si aplica)
  @Prop({ required: false })
  createdBy?: string;
}

export const RoutinePlanSchema = SchemaFactory.createForClass(RoutinePlan);
