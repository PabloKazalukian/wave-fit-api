import { ObjectType, Field, ID, Float, Int } from '@nestjs/graphql';

@ObjectType()
export class TopRoutineEntry {
  @Field(() => Int)
  rank: number;

  @Field(() => ID)
  planId: string;

  @Field()
  name: string;

  @Field(() => Int)
  totalWeeks: number;

  @Field(() => Int)
  totalSessions: number;

  @Field(() => Float)
  adherenceRate: number;
}

@ObjectType()
export class TopRoutineStats {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  userId: string;

  @Field()
  computedAt: Date;

  @Field(() => [TopRoutineEntry])
  routines: TopRoutineEntry[];
}
