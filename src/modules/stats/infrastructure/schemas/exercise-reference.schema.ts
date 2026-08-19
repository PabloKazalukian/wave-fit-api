import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ExerciseCategory } from '../../../routines/templates/exercise/entities/exercise.entity';

@Schema({ timestamps: true })
export class Exercise extends Document {
  @Prop({ unique: true, trim: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({
    type: String,
    enum: ExerciseCategory,
    required: true,
  })
  category: ExerciseCategory;

  @Prop({ default: false })
  usesWeight: boolean;

  @Prop({ trim: true, required: true })
  normalizedName: string;
}

export type ExerciseDocument = Exercise & Document;
export const ExerciseSchema = SchemaFactory.createForClass(Exercise);

ExerciseSchema.index({ category: 1 });
ExerciseSchema.index({ normalizedName: 1 });
