import { CreateRoutinePlanInput } from './create-routine-plan.input';
import { InputType, Field, Int, PartialType } from '@nestjs/graphql';

@InputType()
export class UpdateRoutinePlanInput extends PartialType(
  CreateRoutinePlanInput,
) {
  @Field(() => Int)
  id: number;
}
