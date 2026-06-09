import { ObjectType, Field, ID, Float } from '@nestjs/graphql';

@ObjectType()
class RepsAtWeight {
  @Field(() => Float)
  weightKg: number;

  @Field()
  reps: number;
}

@ObjectType()
export class StrengthMetric {
  @Field(() => ID)
  _id: string;

  @Field(() => ID)
  userId: string;

  @Field()
  exerciseKey: string;

  @Field(() => Float)
  oneRmKg: number;

  @Field(() => RepsAtWeight, { nullable: true })
  repsAtWeight?: RepsAtWeight;

  @Field()
  confidenceLevel: string;

  @Field()
  measuredAt: Date;

  @Field({ nullable: true })
  notes?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
