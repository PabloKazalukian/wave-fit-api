import { CreateWorkoutSessionInput } from './create-workout-session.input';
import { InputType, Field, Int, PartialType } from '@nestjs/graphql';

@InputType()
export class UpdateWorkoutSessionInput extends PartialType(CreateWorkoutSessionInput) {
  @Field(() => Int)
  id: number;
}
