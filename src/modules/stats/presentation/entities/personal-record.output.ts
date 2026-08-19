import { ObjectType, Field, ID, Float } from '@nestjs/graphql';

@ObjectType()
export class PersonalRecordEntry {
  @Field(() => ID)
  exerciseId: string;

  @Field()
  exerciseName: string;

  @Field()
  category: string;

  @Field(() => Float)
  oneRmEstimated: number;

  @Field(() => Float)
  bestWeight: number;

  @Field(() => Float)
  bestReps: number;

  @Field(() => Float)
  bestVolume: number;

  @Field()
  achievedAt: Date;

  @Field(() => Float, { nullable: true })
  previousOneRm: number | null;
}

@ObjectType()
export class PersonalRecordStats {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  userId: string;

  @Field()
  computedAt: Date;

  @Field(() => [PersonalRecordEntry])
  records: PersonalRecordEntry[];
}
