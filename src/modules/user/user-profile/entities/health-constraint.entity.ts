import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
class Injury {
  @Field()
  bodyPart: string;

  @Field()
  severity: string;

  @Field()
  isActive: boolean;

  @Field({ nullable: true })
  description?: string;
}

@ObjectType()
export class HealthConstraint {
  @Field(() => ID)
  _id: string;

  @Field(() => ID)
  userId: string;

  @Field(() => [Injury])
  injuries: Injury[];

  @Field(() => [String])
  movementRestrictions: string[];

  @Field(() => [String])
  conditions: string[];

  @Field()
  mobilityLevel: string;

  @Field()
  hasHealthcareSupervision: boolean;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
