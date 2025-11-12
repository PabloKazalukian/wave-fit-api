import { ObjectType, Field, ID } from '@nestjs/graphql';
import { ExercisePerformance } from './exercise-performance.entity';

@ObjectType()
export class WorkoutSession {
  @Field(() => ID)
  id: string;

  @Field({ nullable: true })
  date?: Date;

  @Field({ nullable: true })
  routineDayId?: string; // referencia al día del plan (si siguió uno)

  @Field(() => [ExercisePerformance], { nullable: 'itemsAndList' })
  exercises?: ExercisePerformance[];

  @Field({ nullable: true })
  notes?: string;
}
