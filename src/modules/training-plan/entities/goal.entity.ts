import { ObjectType, Field, ID, GraphQLISODateTime } from '@nestjs/graphql';

@ObjectType()
export class Goal {
  @Field(() => ID)
  _id: string;

  @Field(() => ID)
  userId: string;

  @Field(() => Object)
  contextSnapshot: Record<string, any>;

  @Field(() => GraphQLISODateTime)
  capturedAt: Date;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt: Date;
}
