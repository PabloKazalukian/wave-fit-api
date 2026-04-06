import { InputType, Field } from '@nestjs/graphql';
import { IsMongoId } from 'class-validator';

@InputType()
export class RemoveWorkoutSessionFromDayInput {
  @Field(() => String)
  @IsMongoId()
  workoutSessionId: string;
}
