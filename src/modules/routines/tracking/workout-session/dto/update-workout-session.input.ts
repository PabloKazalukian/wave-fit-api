import { CreateWorkoutSessionInput } from './create-workout-session.input';
import { InputType, Field, Int, PartialType } from '@nestjs/graphql';
import { IsMongoId, IsOptional } from 'class-validator';

@InputType()
export class UpdateWorkoutSessionInput extends PartialType(
  CreateWorkoutSessionInput,
) {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsMongoId()
  id?: string;
}
