import { ObjectType, Field, ID, Int, Float } from '@nestjs/graphql';

@ObjectType()
export class SetPerformance {
  @Field(() => Int)
  reps: number;

  @Field(() => Float, { nullable: true })
  weights?: number;
}

@ObjectType()
export class ExercisePerformance {
  @Field()
  exerciseId: string;

  @Field(() => Int)
  series: number;

  @Field(() => [SetPerformance])
  sets: SetPerformance[];

  @Field({ nullable: true })
  notes?: string;
}

@ObjectType()
export class WorkoutSession {
  @Field(() => ID)
  id: string;

  @Field()
  userId: string;

  @Field()
  weekLogId: string;

  @Field()
  date: Date;

  @Field({ nullable: true })
  routineDayId?: string;

  @Field(() => [ExercisePerformance])
  exercises: ExercisePerformance[];

  @Field()
  status: string;

  @Field({ nullable: true })
  notes?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => Boolean, { defaultValue: false })
  edited: boolean;
}
