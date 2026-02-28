import { InputType, Field, Int } from '@nestjs/graphql';
import {
  IsOptional,
  IsString,
  IsBoolean,
  IsDateString,
  IsArray,
  IsMongoId,
} from 'class-validator';

// update-week-log-day.input.ts
@InputType()
export class UpdateWeekLogDayInput {
  @Field(() => Int)
  order: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsMongoId()
  workoutSessionId?: string;

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

  @Field(() => [UpdateWeekLogDayInput], { nullable: true }) // ✅ reemplaza workoutSessionIds
  @IsOptional()
  @IsArray()
  days?: UpdateWeekLogDayInput[];

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}
