import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class ForgottenMuscle {
  @Field()
  muscle: string;

  @Field(() => Int)
  totalSets: number;

  @Field(() => Int)
  weeksWithoutWork: number;

  @Field(() => Date, { nullable: true })
  lastTrainedAt?: Date | null;
}