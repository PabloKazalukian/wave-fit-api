import { InputType, Field } from '@nestjs/graphql';
import { IsOptional, IsString } from 'class-validator';
import { CreateExerciseInput } from '../../exercise/dto/create-exercise.input';

@InputType()
export class CreateRoutineDayInput {
  @Field()
  @IsString()
  title: string;

  @Field({ nullable: true })
  @IsOptional()
  type?: string;

  @Field(() => [CreateExerciseInput], { nullable: 'itemsAndList' })
  @IsOptional()
  exercises?: CreateExerciseInput[]; // IDs o nombres de ejercicios

  @Field({ nullable: true })
  @IsOptional()
  planId?: string;
}
