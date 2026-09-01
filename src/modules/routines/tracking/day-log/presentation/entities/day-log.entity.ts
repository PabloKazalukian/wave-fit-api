import { ObjectType, Field, ID } from '@nestjs/graphql';
import { ExercisePerformance } from '../../../workout-session/entities/workout-session.entity';

@ObjectType()
export class DayLog {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  userId: string;

  @Field()
  date: Date;

  @Field(() => ID, { nullable: true })
  planId?: string | null;

  @Field(() => ID, { nullable: true })
  routineDayId?: string | null;

  @Field(() => ID, { nullable: true })
  workoutSessionId?: string | null;

  @Field(() => [ExercisePerformance], { nullable: true })
  exercises?: ExercisePerformance[];

  @Field(() => [ID])
  extraSessionIds: string[];

  @Field()
  status: string;

  @Field()
  active: boolean;

  @Field()
  completed: boolean;

  @Field({ nullable: true })
  notes?: string;
}
