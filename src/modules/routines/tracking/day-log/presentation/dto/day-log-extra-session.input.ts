import { InputType, Field, Int } from '@nestjs/graphql';
import {
  IsNotEmpty,
  IsString,
  IsDateString,
  IsNumber,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

/**
 * Datos de la ExtraSession a crear vinculada al day-log.
 * El workoutSessionId lo resuelve el use case (como en updateWeekDay).
 */
@InputType()
export class DayLogExtraSessionInput {
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