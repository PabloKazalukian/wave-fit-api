import { ObjectType, Field, ID, Int, Float, registerEnumType } from '@nestjs/graphql';
import { ExerciseCategory } from '../../../routines/templates/exercise/entities/exercise.entity';

export enum TrendLabel {
  UP = 'up',
  FLAT = 'flat',
  DOWN = 'down',
  INSUFFICIENT = 'insufficient',
}

registerEnumType(TrendLabel, {
  name: 'TrendLabel',
});

@ObjectType()
export class ExerciseTrend {
  @Field(() => ID)
  exerciseId: string;

  @Field()
  name: string;

  @Field(() => ExerciseCategory)
  category: ExerciseCategory;

  @Field(() => Float, { nullable: true })
  slope?: number | null;

  @Field(() => Float, { nullable: true })
  pctChange?: number | null;

  @Field(() => TrendLabel)
  label: TrendLabel;

  @Field(() => Int)
  weeksUsed: number;
}