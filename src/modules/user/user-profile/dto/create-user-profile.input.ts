import { InputType, Field, Float } from '@nestjs/graphql';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsIn,
  Min,
  Max,
} from 'class-validator';

const GENDER_VALUES = ['M', 'F', 'other'] as const;
const UNITS_VALUES = ['metric', 'imperial'] as const;

@InputType()
export class CreateUserProfileInput {
  @Field(() => String)
  @IsString()
  @IsIn(GENDER_VALUES)
  gender: string;

  @Field(() => String)
  @IsDateString()
  birthDate: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(280)
  heightCm?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(20)
  @Max(500)
  weightKg?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(70)
  bodyFatPct?: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @IsIn(UNITS_VALUES)
  unitsPreference?: string;
}
