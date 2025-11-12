import { InputType, Int, Field } from '@nestjs/graphql';

@InputType()
export class CreateWorkoutSessionInput {
  @Field(() => Int, { description: 'Example field (placeholder)' })
  exampleField: number;
}
