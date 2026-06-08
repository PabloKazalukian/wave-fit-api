import { CreateTrainingPlanInput } from './create-training-plan.input';
import { InputType, Field, Int, PartialType } from '@nestjs/graphql';

@InputType()
export class UpdateTrainingPlanInput extends PartialType(CreateTrainingPlanInput) {
  @Field(() => Int)
  id: number;
}
