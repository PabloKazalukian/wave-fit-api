import { InputType, Field, Int } from '@nestjs/graphql';
import { IsOptional } from 'class-validator';
import { ExerciseCategory } from '../../exercise/entities/exercise.entity';

@InputType()
class RoutineDayExerciseInput {
  @Field(() => String)
  exercise: string;

  @Field(() => Int)
  order: number;
}

@InputType()
export class CreateRoutineDayInput {
  @Field()
  title: string;

  @Field(() => [ExerciseCategory])
  type: ExerciseCategory[];

  @Field(() => [RoutineDayExerciseInput])
  exercises: RoutineDayExerciseInput[];

  @Field({ nullable: true })
  @IsOptional()
  planId?: string;
}
