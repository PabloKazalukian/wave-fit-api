import { CreateExerciseInput } from './create-exercise.input';
import { InputType, Field, ID, PartialType } from '@nestjs/graphql';

@InputType()
export class UpdateExerciseInput extends PartialType(CreateExerciseInput) {
  @Field(() => ID)
  id: string;
}
