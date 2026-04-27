import { InputType, Int, Field } from '@nestjs/graphql';

@InputType()
export class CreateStatInput {
  @Field(() => Int, { description: 'Example field (placeholder)' })
  exampleField: number;
}
