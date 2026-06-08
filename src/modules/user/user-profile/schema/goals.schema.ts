import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum PrimaryGoal {
  FAT_LOSS = 'fat_loss',
  MUSCLE_GAIN = 'muscle_gain',
  STRENGTH = 'strength',
  ENDURANCE = 'endurance',
  MAINTENANCE = 'maintenance',
  RECOMP = 'recomp',
}

export enum TrainingExperience {
  BEGINNER = 'beginner', // < 6 meses
  INTERMEDIATE = 'intermediate', // 6 meses – 2 años
  ADVANCED = 'advanced', // 2–5 años
  ATHLETE = 'athlete', // Competidor / alto rendimiento
}

@Schema({ timestamps: true })
export class UserGoal extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: PrimaryGoal })
  primaryGoal: PrimaryGoal;

  @Prop({ type: [String], default: [] })
  secondaryGoals: string[];

  @Prop({ type: Number, min: 20, max: 500, default: null })
  targetWeightKg?: number;

  @Prop({ type: Number, min: 1, max: 156, default: null })
  timelineWeeks?: number;

  @Prop({ required: true, enum: TrainingExperience })
  trainingExperience: TrainingExperience;

  @Prop({ type: String, trim: true, default: null })
  sportSpecificity?: string;

  // Flag para saber si es el objetivo activo. Solo uno activo por usuario.
  @Prop({ type: Boolean, default: true, index: true })
  isActive: boolean;
}

export const UserGoalSchema = SchemaFactory.createForClass(UserGoal);

UserGoalSchema.index({ userId: 1, isActive: 1 });
