import { InputType, Int, Field } from '@nestjs/graphql';

@InputType()
export class CreateExtraSessionInput {
  @Field(() => Int, { description: 'Example field (placeholder)' })
  exampleField: number;
}
