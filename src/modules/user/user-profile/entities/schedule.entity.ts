import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class Schedule {
  @Field(() => ID)
  _id: string;

  @Field(() => ID)
  userId: string;

  @Field()
  daysPerWeek: number;

  @Field(() => [Number])
  preferredDays: number[];

  @Field()
  sessionDurationMin: number;

  @Field({ nullable: true })
  preferredTime?: string;

  @Field()
  restDayActivity: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
