import { CreateTrainingPlanInput } from './create-training-plan.input';
import { InputType, Field, ID, PartialType } from '@nestjs/graphql';

@InputType()
export class UpdateTrainingPlanInput extends PartialType(CreateTrainingPlanInput) {
  @Field(() => ID)
  id: string;
}
