import { registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ExerciseCategory } from 'src/common/interfaces/exercise.interface';
import { Exercise } from '../../exercise/schema/exercise.schema';

registerEnumType(ExerciseCategory, {
  name: 'ExerciseCategory',
});

@Schema({ timestamps: true })
export class RoutineDay extends Document {
  @Prop({ required: true })
  title: string;

  // Ejemplo: "entrenamiento", "descanso", "cardio"
  @Prop({ type: [String], enum: ExerciseCategory, required: true })
  type: ExerciseCategory[];

  // Array de ejercicios (referencias)
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Exercise' }], default: [] })
  exercises: Types.ObjectId[];

  // Referencia al plan al que pertenece
  @Prop({ type: Types.ObjectId, ref: 'RoutinePlan', required: false })
  planId?: Types.ObjectId;
}

export const RoutineDaySchema = SchemaFactory.createForClass(RoutineDay);
RoutineDaySchema.index({ type: 1 });

RoutineDaySchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_, ret: any) => {
    ret.id = ret._id.toString();
    delete ret._id;

    // Convertir exercises a string si no hay populate
    if (Array.isArray(ret.exercises)) {
      ret.exercises = ret.exercises.map((e) => e.toString());
    }

    // Convertir planId si existe
    if (ret.planId) ret.planId = ret.planId.toString();

    return ret;
  },
});
