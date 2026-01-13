import { InputType, Field } from '@nestjs/graphql';
import { IsOptional, IsString } from 'class-validator';
import { CreateExerciseInput } from '../../exercise/dto/create-exercise.input';
import { ExerciseCategory } from 'src/common/interfaces/exercise.interface';

@InputType()
export class CreateRoutineDayInput {
  @Field()
  @IsString()
  title: string;

  @Field(() => [ExerciseCategory], { nullable: true })
  type?: ExerciseCategory[];

  @Field(() => [String])
  exercises?: string[]; // IDs o nombres de ejercicios

  @Field({ nullable: true })
  @IsOptional()
  planId?: string;
}
