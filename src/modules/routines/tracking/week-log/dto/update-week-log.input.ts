import { InputType, Field } from '@nestjs/graphql';
import {
  IsOptional,
  IsString,
  IsBoolean,
  IsDateString,
  IsArray,
  IsMongoId,
} from 'class-validator';

@InputType()
export class UpdateWeekLogInput {
  @Field(() => String)
  @IsString()
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
  @IsString()
  @IsMongoId()
  planId?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  workoutSessionIds?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}
