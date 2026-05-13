import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ExerciseCategory } from '../entities/exercise.entity';

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

  // true = barra/mancuerna, false = peso corporal
  @Prop({ default: false })
  usesWeight: boolean;
}

export const ExerciseSchema = SchemaFactory.createForClass(Exercise);

ExerciseSchema.index({ category: 1 });
