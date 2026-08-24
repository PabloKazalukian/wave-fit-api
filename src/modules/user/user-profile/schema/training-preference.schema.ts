import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum TrainingStyle {
  POWERLIFTING = 'powerlifting',
  HYPERTROPHY = 'hypertrophy',
  HIIT = 'hiit',
  CIRCUIT = 'circuit',
  FUNCTIONAL = 'functional',
  PILATES = 'pilates',
  YOGA = 'yoga',
  CALISTHENICS = 'calisthenics',
  CARDIO = 'cardio',
  CROSSFIT = 'crossfit',
}

export enum CardioPreference {
  NONE = 'none',
  LOW_INTENSITY = 'low_intensity', // LISS: caminata, bici suave
  HIIT = 'hiit',
  MIXED = 'mixed',
}

export enum IntensityPreference {
  LIGHT = 'light', // RPE 4–5
  MODERATE = 'moderate', // RPE 6–7
  INTENSE = 'intense', // RPE 8–9
  MAX_EFFORT = 'max_effort', // RPE 10
}

@Schema({ timestamps: true })
export class UserTrainingPreference extends Document {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: [String],
    enum: TrainingStyle,
    validate: [
      (v: string[]) => v.length > 0,
      'Se requiere al menos un estilo de entrenamiento',
    ],
  })
  preferredStyles: TrainingStyle[];

  // Ejercicios que el usuario quiere evitar (por nombre, ej: "burpees", "leg press")
  @Prop({ type: [String], default: [] })
  dislikedExercises: string[];

  // Ejercicios favoritos que la IA prioriza si son compatibles con el objetivo
  @Prop({
    type: [{ type: Types.ObjectId, ref: 'Exercise' }],
    default: [],
  })
  favoriteExercises: Types.ObjectId[];

  // Rutinas favoritas del usuario (referencias a RoutinePlan)
  @Prop({
    type: [{ type: Types.ObjectId, ref: 'RoutinePlan' }],
    default: [],
  })
  favoriteRoutines: Types.ObjectId[];

  @Prop({
    type: String,
    enum: CardioPreference,
    default: CardioPreference.NONE,
  })
  cardioPreference: CardioPreference;

  @Prop({
    type: String,
    enum: IntensityPreference,
    default: IntensityPreference.MODERATE,
  })
  intensityPreference: IntensityPreference;

  // Preferencia de música/ambiente — útil si integrás con Spotify o similar
  @Prop({ type: String, trim: true, default: null })
  workoutVibe?: string;
}

export const UserTrainingPreferenceSchema = SchemaFactory.createForClass(
  UserTrainingPreference,
);
