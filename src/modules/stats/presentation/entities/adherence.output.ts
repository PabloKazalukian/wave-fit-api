import { ObjectType, Field, ID, Float, Int } from '@nestjs/graphql';

@ObjectType()
export class AdherenceWeekEntry {
  @Field()
  weekStartDate: Date;

  @Field(() => Int)
  totalDays: number;

  @Field(() => Int)
  completedDays: number;

  @Field(() => Int)
  skippedDays: number;

  @Field(() => Int)
  pendingDays: number;

  @Field(() => Float)
  adherencePercent: number;
}

@ObjectType()
export class AdherenceStats {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  userId: string;

  @Field()
  computedAt: Date;

  @Field(() => [AdherenceWeekEntry])
  weeks: AdherenceWeekEntry[];
}
