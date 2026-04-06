import { InputType, Field, Int } from '@nestjs/graphql';
import {
  IsOptional,
  IsString,
  IsBoolean,
  IsDateString,
  IsArray,
  IsMongoId,
} from 'class-validator';
import { ExercisePerformance } from '../../../workout-session/schema/exercise-performance.schema';

import { UpdateWorkoutSessionInput } from '../../../workout-session/dto/update-workout-session.input';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

// update-week-log-day.input.ts
@InputType()
export class UpdateWeekLogDayInput {
  @Field(() => Int)
  order: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsMongoId()
  workoutSessionId?: string;

  @Field(() => UpdateWorkoutSessionInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateWorkoutSessionInput)
  workoutSession?: UpdateWorkoutSessionInput;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isRest?: boolean;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  extraSessionIds?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  status?: string; // 'pending' | 'complete' | 'skipped'
}

// update-week-log.input.ts
@InputType()
export class UpdateWeekLogInput {
  @Field(() => String)
  @IsMongoId()
  id: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsMongoId()
  planId?: string;

  @Field()
  userId?: string;

  @Field(() => [UpdateWeekLogDayInput], { nullable: true }) // ✅ reemplaza workoutSessionIds
  @IsOptional()
  @IsArray()
  days?: UpdateWeekLogDayInput[];

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  @Field({ nullable: true })
  @IsBoolean()
  active?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}
