import { CreateRoutinePlanInput } from './create-routine-plan.input';
import { InputType, Field, ID, PartialType } from '@nestjs/graphql';

@InputType()
export class UpdateRoutinePlanInput extends PartialType(
  CreateRoutinePlanInput,
) {
  @Field(() => ID)
  id: string;
}
