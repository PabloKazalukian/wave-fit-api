import { InputType, Field, Int } from '@nestjs/graphql';
import {
  IsNotEmpty,
  IsString,
  IsDateString,
  IsArray,
  ValidateNested,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  IsMongoId,
} from 'class-validator';
import { Type } from 'class-transformer';
import { StatusWorkoutSessionEnum } from '../schema/workout-session.schema';

@InputType()
export class SetPerformanceInput {
  @Field(() => Int)
  @IsNumber()
  @Min(0)
  reps: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weights?: number;
}

@InputType()
export class ExercisePerformanceInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  exerciseId: string;

  @Field(() => Int)
  @IsNumber()
  @Min(0)
  series: number;

  @Field(() => [SetPerformanceInput])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SetPerformanceInput)
  sets: SetPerformanceInput[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

@InputType()
export class CreateWorkoutSessionInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  weekLogId: string;

  @Field()
  @IsNotEmpty()
  @IsDateString()
  date: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsMongoId()
  routineDayId?: string;

  @Field(() => [ExercisePerformanceInput])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExercisePerformanceInput)
  exercises: ExercisePerformanceInput[];

  @Field(() => String)
  @IsEnum(StatusWorkoutSessionEnum)
  status: StatusWorkoutSessionEnum;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}
