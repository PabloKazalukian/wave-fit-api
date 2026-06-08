import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class TrainingPlan {
  @Field(() => Int, { description: 'Example field (placeholder)' })
  exampleField: number;
}
