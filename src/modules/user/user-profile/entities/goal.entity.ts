import { ObjectType, Field, ID, Float } from '@nestjs/graphql';

@ObjectType()
export class Goal {
  @Field(() => ID)
  _id: string;

  @Field(() => ID)
  userId: string;

  @Field()
  primaryGoal: string;

  @Field(() => [String])
  secondaryGoals: string[];

  @Field(() => Float, { nullable: true })
  targetWeightKg?: number;

  @Field({ nullable: true })
  timelineWeeks?: number;

  @Field()
  trainingExperience: string;

  @Field({ nullable: true })
  sportSpecificity?: string;

  @Field()
  isActive: boolean;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
