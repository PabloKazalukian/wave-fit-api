import { ObjectType, Field, Int, GraphQLISODateTime } from '@nestjs/graphql';
import { GraphQLJSONObject } from 'graphql-type-json';

@ObjectType()
export class AiSnapshotEntity {
  @Field(() => GraphQLJSONObject)
  contextSentToAI: Record<string, any>;

  @Field()
  promptUsed: string;

  @Field()
  modelUsed: string;

  @Field(() => GraphQLJSONObject)
  rawResponse: Record<string, any>;

  @Field(() => Int, { nullable: true })
  tokensUsed?: number;

  @Field(() => GraphQLISODateTime)
  generatedAt: Date;
}
