import { ObjectType, Field, Float } from '@nestjs/graphql';

@ObjectType()
export class VolumeTotalWeeklyEntry {
  @Field()
  weekKey: string;

  @Field(() => Float)
  totalVolume: number;

  @Field(() => Float, { nullable: true })
  deltaPct?: number | null;

  @Field()
  possibleDeload: boolean;
}