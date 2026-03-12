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

RoutineDaySchema.index({ type: 1 });
RoutineDaySchema.index({ 'exercises.exercise': 1 });
