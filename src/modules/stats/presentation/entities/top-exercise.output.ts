import { ObjectType, Field, ID, Float, Int } from '@nestjs/graphql';

@ObjectType()
export class TopExerciseEntry {
  @Field(() => Int)
  rank: number;

  @Field(() => ID)
  exerciseId: string;

  @Field()
  name: string;

  @Field()
  category: string;

  @Field(() => Int)
  totalSessions: number;

  @Field(() => Float)
  totalVolume: number;

  @Field(() => Float)
  avgVolumePerSession: number;
}

@ObjectType()
export class TopExerciseStats {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  userId: string;

  @Field()
  computedAt: Date;

  @Field(() => [TopExerciseEntry])
  exercises: TopExerciseEntry[];
}
