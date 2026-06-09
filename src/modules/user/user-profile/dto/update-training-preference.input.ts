import { InputType, Field } from '@nestjs/graphql';
import {
  IsString,
  IsOptional,
  IsArray,
  IsIn,
  ArrayMinSize,
} from 'class-validator';

const TRAINING_STYLE_VALUES = [
  'powerlifting', 'hypertrophy', 'hiit', 'circuit',
  'functional', 'pilates', 'yoga', 'calisthenics',
  'cardio', 'crossfit',
] as const;

const CARDIO_PREFERENCE_VALUES = [
  'none', 'low_intensity', 'hiit', 'mixed',
] as const;

const INTENSITY_PREFERENCE_VALUES = [
  'light', 'moderate', 'intense', 'max_effort',
] as const;

@InputType()
export class UpdateTrainingPreferenceInput {
  @Field(() => [String])
  @IsArray()
  @IsString({ each: true })
  @IsIn(TRAINING_STYLE_VALUES, { each: true })
  @ArrayMinSize(1)
  preferredStyles: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dislikedExercises?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  favoriteExercises?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsIn(CARDIO_PREFERENCE_VALUES)
  cardioPreference?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsIn(INTENSITY_PREFERENCE_VALUES)
  intensityPreference?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  workoutVibe?: string;
}
