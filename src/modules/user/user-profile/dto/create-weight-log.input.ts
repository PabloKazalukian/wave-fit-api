import { InputType, Field, Float } from '@nestjs/graphql';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  Min,
  Max,
} from 'class-validator';

@InputType()
export class CreateWeightLogInput {
  @Field(() => Float)
  @IsNumber()
  @Min(20)
  @Max(500)
  weightKg: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(70)
  bodyFatPct?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  loggedAt?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}
