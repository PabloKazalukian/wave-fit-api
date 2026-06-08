import { InputType, Int, Field } from '@nestjs/graphql';

@InputType()
export class CreateTrainingPlanInput {
  @Field(() => Int, { description: 'Example field (placeholder)' })
  exampleField: number;
}
