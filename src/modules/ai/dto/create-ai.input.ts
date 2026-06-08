import { InputType, Int, Field } from '@nestjs/graphql';

@InputType()
export class CreateAiInput {
  @Field(() => Int, { description: 'Example field (placeholder)' })
  exampleField: number;
}
