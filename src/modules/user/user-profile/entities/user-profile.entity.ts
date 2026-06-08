import { ObjectType, Field, ID, Float } from '@nestjs/graphql';

@ObjectType()
export class UserProfile {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  userId: string;

  @Field()
  sex: string;

  @Field()
  birthDate: Date;

  @Field(() => Float)
  heightCm: number;

  @Field(() => Float)
  weightKg: number;

  @Field(() => Float, { nullable: true })
  bodyFatPct?: number;

  @Field()
  unitsPreference: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
