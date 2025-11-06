import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class RoutineDay extends Document {
  @Prop({ required: true })
  title: string;

  // Ejemplo: "entrenamiento", "descanso", "cardio"
  @Prop({ required: false })
  type?: string;

  // Array de ejercicios (referencias)
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Exercise' }], default: [] })
  exercises: Types.ObjectId[];

  // Referencia al plan al que pertenece
  @Prop({ type: Types.ObjectId, ref: 'RoutinePlan', required: false })
  planId?: Types.ObjectId;
}

export const RoutineDaySchema = SchemaFactory.createForClass(RoutineDay);
