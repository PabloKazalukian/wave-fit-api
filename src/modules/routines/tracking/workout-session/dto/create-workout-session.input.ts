import { InputType, Int, Field, ID } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString } from 'class-validator';
import { ExercisePerformance } from '../schema/exercise-performance.schema';

@InputType()
export class CreateWorkoutSessionInput {
  @Field(() => Date)
  @IsDate()
  @Type(() => Date)
  date?: Date;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  routineDayId?: string;

  // @Field(() => [ExercisePerformance], { nullable: 'itemsAndList' })
  // exercises?: ExercisePerformance[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}
