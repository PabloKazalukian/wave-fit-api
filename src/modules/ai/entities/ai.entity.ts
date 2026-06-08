import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class Ai {
  @Field(() => Int, { description: 'Example field (placeholder)' })
  exampleField: number;
}
