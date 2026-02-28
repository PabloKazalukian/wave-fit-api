// week-log.type.ts (o similar en el backend)

import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

@ObjectType()
export class WeekLogDay {
  @Field(() => Int)
  order: number;

  @Field()
  date: Date;

  @Field()
  isRest: boolean;

  @Field(() => String, { nullable: true })
  workoutSessionId?: string | null;

  @Field(() => [String])
  extraSessionIds: string[];

  @Field()
  status: string;
}

@ObjectType()
export class WeekLog {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  userId: string;

  @Field()
  startDate: Date;

  @Field()
  endDate: Date;

  @Field(() => String, { nullable: true })
  planId?: string | null;

  @Field(() => [WeekLogDay]) // 👈 esto es lo que falta
  days: WeekLogDay[];

  @Field()
  completed: boolean;

  @Field({ nullable: true })
  notes?: string;
}

@ObjectType()
export class ActiveWeekLogResponse {

  @Field(() => Boolean)
  hasActiveWeek: boolean;

  @Field(() => WeekLog, { nullable: true })
  week?: WeekLog;
}