import { registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Exercise } from '../../exercise/schema/exercise.schema';
import { ExerciseCategory } from '../../exercise/entities/exercise.entity';

registerEnumType(ExerciseCategory, {
  name: 'ExerciseCategory',
});

@Schema({ timestamps: true })
export class RoutineDay {
  @Prop({ required: true })
  title: string;

  @Prop({ type: [String], enum: ExerciseCategory, required: true })
  type: ExerciseCategory[];

  @Prop({
    type: [
      {
        exercise: {
          type: Types.ObjectId,
          ref: 'Exercise',
          required: true,
        },
        order: {
          type: Number,
          required: true,
        },
      },
    ],
    default: [],
  })
  exercises: {
    exercise: Types.ObjectId;
    order: number;
  }[];

  @Prop({ type: Types.ObjectId, ref: 'RoutinePlan' })
  planId?: Types.ObjectId;
}

export type RoutineDayDocument = HydratedDocument<RoutineDay>;

export const RoutineDaySchema = SchemaFactory.createForClass(RoutineDay);

/*
  🔥 Transform definitivo
  - Convierte _id → id
  - Convierte ObjectIds a string
  - Mantiene estructura correcta de exercises
*/

RoutineDaySchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_, ret: any) => {
    ret.id = ret._id.toString();
    delete ret._id;

    if (Array.isArray(ret.exercises)) {
      ret.exercises = ret.exercises.map((e: any) => {
        let exerciseVal;
        if (e.exercise && typeof e.exercise === 'object' && e.exercise._id) {
          // Si está poblado, lo mantenemos y le seteamos 'id'
          e.exercise.id = e.exercise._id.toString();
          delete e.exercise._id;
          exerciseVal = e.exercise;
        } else {
          // Si no está poblado, extraemos solo el string del id
          exerciseVal = e.exercise?.toString();
        }

        return {
          exercise: exerciseVal,
          order: e.order,
        };
      });
    }

    if (ret.planId) {
      ret.planId = ret.planId.toString();
    }

    return ret;
  },
});

RoutineDaySchema.index({ type: 1 });
RoutineDaySchema.index({ 'exercises.exercise': 1 });
