import { InputType, Int, Field } from '@nestjs/graphql';

@InputType()
export class CreateWeekLogInput {
  @Field(() => Int, { description: 'Example field (placeholder)' })
  exampleField: number;
}
