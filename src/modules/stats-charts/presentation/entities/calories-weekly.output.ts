import { ObjectType, Field, Float, Int } from '@nestjs/graphql';

@ObjectType()
export class CaloriesWeeklyEntry {
  @Field()
  weekKey: string;

  @Field(() => Float, { nullable: true })
  routineKcal?: number | null;

  @Field(() => Float)
  extraKcal: number;

  @Field(() => Float)
  totalKcal: number;

  @Field(() => Int)
  estimatedSessions: number;
}