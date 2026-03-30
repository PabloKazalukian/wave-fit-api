import { InputType, Int, Field } from '@nestjs/graphql';
import {
  IsNotEmpty,
  IsString,
  IsDateString,
  IsNumber,
  IsOptional,
  Min,
  Max,
  IsMongoId,
} from 'class-validator';

@InputType()
export class CreateExtraSessionInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  @IsMongoId()
  workoutSessionId: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  type: string;

  @Field()
  @IsNotEmpty()
  @IsDateString()
  date: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  discipline: string;

  @Field(() => Int)
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  duration: number;

  @Field(() => Int)
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(5)
  intensityLevel: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  calories?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}
