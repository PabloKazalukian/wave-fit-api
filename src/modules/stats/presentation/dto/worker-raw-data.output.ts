import { ObjectType, Field, ID, Float } from '@nestjs/graphql';

@ObjectType()
class RawSetData {
  @Field(() => Float)
  reps: number;

  @Field(() => Float, { nullable: true })
  weights?: number;
}

@ObjectType()
class RawExercisePerformance {
  @Field(() => ID)
  exerciseId: string;

  @Field(() => Float)
  series: number;

  @Field(() => [RawSetData])
  sets: RawSetData[];
}

@ObjectType()
class RawWorkoutSession {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  userId: string;

  @Field()
  date: Date;

  @Field(() => ID, { nullable: true })
  routineDayId?: string;

  @Field()
  status: string;

  @Field(() => [RawExercisePerformance])
  exercises: RawExercisePerformance[];
}

@ObjectType()
class RawWeekLogDay {
  @Field(() => Float)
  order: number;

  @Field()
  date: Date;

  @Field()
  isRest: boolean;

  @Field()
  status: string;
}

@ObjectType()
class RawWeekLog {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  userId: string;

  @Field()
  startDate: Date;

  @Field()
  endDate: Date;

  @Field(() => ID, { nullable: true })
  planId?: string;

  @Field()
  completed: boolean;

  @Field(() => [RawWeekLogDay])
  days: RawWeekLogDay[];
}

@ObjectType()
class RawExercise {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  category: string;

  @Field()
  usesWeight: boolean;
}

@ObjectType()
class RawRoutinePlan {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  description: string;
}

@ObjectType()
class RawStrengthMetric {
  @Field(() => ID)
  id: string;

  @Field()
  exerciseKey: string;

  @Field(() => Float)
  oneRmKg: number;

  @Field()
  measuredAt: Date;
}

@ObjectType()
export class WorkerRawData {
  @Field(() => [RawWorkoutSession])
  workoutSessions: RawWorkoutSession[];

  @Field(() => [RawWeekLog])
  weekLogs: RawWeekLog[];

  @Field(() => [RawExercise])
  exercises: RawExercise[];

  @Field(() => [RawRoutinePlan])
  routinePlans: RawRoutinePlan[];

  @Field(() => [RawStrengthMetric])
  strengthMetrics: RawStrengthMetric[];
}
