import { ObjectType, Field, ID, Float } from '@nestjs/graphql';

@ObjectType()
export class UserProfile {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  userId: string;

  @Field()
  gender: string;

  @Field({ nullable: true })
  birthDate: Date;

  @Field(() => Float, { nullable: true })
  heightCm?: number;

  @Field(() => Float, { nullable: true })
  weightKg?: number;

  @Field(() => Float, { nullable: true })
  bodyFatPct?: number;

  @Field({ nullable: true })
  unitsPreference?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
