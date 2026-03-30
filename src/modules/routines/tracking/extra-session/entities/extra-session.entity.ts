import { ObjectType, Field, ID, Float, Int } from '@nestjs/graphql';

@ObjectType()
export class ExtraSession {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  userId: string;

  @Field(() => ID)
  workoutSessionId: string;

  @Field()
  type: string;

  @Field()
  date: Date;

  @Field()
  discipline: string;

  @Field(() => Int)
  duration: number;

  @Field(() => Int)
  intensityLevel: number;

  @Field(() => Float, { nullable: true })
  calories?: number;

  @Field({ nullable: true })
  notes?: string;
}
