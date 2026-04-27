import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class Stat {
  @Field(() => Int, { description: 'Example field (placeholder)' })
  exampleField: number;
}
