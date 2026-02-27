import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class WeekLogDay {
  @Field()
  order: number;

  @Field()
  date: Date;

  @Field()
  isRest: boolean;

  @Field(() => ID, { nullable: true })
  workoutSessionId?: string;

  @Field(() => [ID], { nullable: 'itemsAndList' })
  extraSessionIds?: string[];

  @Field()
  status: string; // pending | complete | skipped
}
