import { InputType, Field, Float } from '@nestjs/graphql';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsIn,
  Min,
  Max,
} from 'class-validator';

const PRIMARY_GOAL_VALUES = [
  'fat_loss',
  'muscle_gain',
  'strength',
  'endurance',
  'maintenance',
  'recomp',
] as const;

const TRAINING_EXPERIENCE_VALUES = [
  'beginner',
  'intermediate',
  'advanced',
  'athlete',
] as const;

@InputType()
export class UpdateGoalsInput {
  @Field(() => String)
  @IsString()
  @IsIn(PRIMARY_GOAL_VALUES)
  primaryGoal: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  secondaryGoals?: string[];

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(20)
  @Max(500)
  targetWeightKg?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(156)
  timelineWeeks?: number;

  @Field(() => String)
  @IsString()
  @IsIn(TRAINING_EXPERIENCE_VALUES)
  trainingExperience: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  sportSpecificity?: string;
}
