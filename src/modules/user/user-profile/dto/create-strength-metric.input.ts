import { InputType, Field, Float } from '@nestjs/graphql';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  Min,
  Max,
  ValidateNested,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

const CONFIDENCE_LEVEL_VALUES = ['tested', 'estimated', 'self_reported'] as const;

@InputType()
class RepsAtWeightInput {
  @Field(() => Float)
  @IsNumber()
  weightKg: number;

  @Field()
  @IsNumber()
  @Min(1)
  @Max(30)
  reps: number;
}

@InputType()
export class CreateStrengthMetricInput {
  @Field()
  @IsString()
  exerciseKey: string;

  @Field(() => Float)
  @IsNumber()
  @Min(0)
  oneRmKg: number;

  @Field(() => RepsAtWeightInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => RepsAtWeightInput)
  repsAtWeight?: RepsAtWeightInput;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsIn(CONFIDENCE_LEVEL_VALUES)
  confidenceLevel?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  measuredAt?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}
