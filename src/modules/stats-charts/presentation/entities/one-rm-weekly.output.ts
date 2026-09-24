import { ObjectType, Field, ID, Int, Float } from '@nestjs/graphql';
import { ExerciseCategory } from '../../../routines/templates/exercise/entities/exercise.entity';

@ObjectType()
export class WeekOneRm {
  @Field()
  weekKey: string;

  @Field(() => Float, { nullable: true })
  best1RM?: number | null;

  @Field(() => Float, { nullable: true })
  weightUsed?: number | null;

  @Field(() => Int, { nullable: true })
  reps?: number | null;

  @Field()
  participated: boolean;
}

@ObjectType()
export class Exercise1RmWeekly {
  @Field(() => ID)
  exerciseId: string;

  @Field()
  name: string;

  @Field(() => ExerciseCategory)
  category: ExerciseCategory;

  @Field(() => [WeekOneRm])
  weeks: WeekOneRm[];
}