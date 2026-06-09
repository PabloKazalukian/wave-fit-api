import { ObjectType, Field, ID, Float } from '@nestjs/graphql';

@ObjectType()
export class WeightLog {
  @Field(() => ID)
  _id: string;

  @Field(() => ID)
  userId: string;

  @Field(() => Float)
  weightKg: number;

  @Field(() => Float, { nullable: true })
  bodyFatPct?: number;

  @Field()
  loggedAt: Date;

  @Field({ nullable: true })
  notes?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
