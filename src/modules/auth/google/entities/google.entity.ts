import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class Google {
  @Field(() => Int, { description: 'Example field (placeholder)' })
  exampleField: number;
}
