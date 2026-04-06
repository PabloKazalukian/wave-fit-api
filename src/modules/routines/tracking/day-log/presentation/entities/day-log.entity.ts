import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class DayLog {
  @Field(() => Int, { description: 'Example field (placeholder)' })
  exampleField: number;
}
