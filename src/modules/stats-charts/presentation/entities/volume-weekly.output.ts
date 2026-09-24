import { ObjectType, Field, ID, Int, Float } from '@nestjs/graphql';
import { ExerciseCategory } from '../../../routines/templates/exercise/entities/exercise.entity';

@ObjectType()
export class ExerciseVolume {
  @Field(() => ID)
  exerciseId: string;

  @Field()
  name: string;

  @Field(() => ExerciseCategory)
  category: ExerciseCategory;

  @Field(() => Float)
  volume: number;
}

@ObjectType()
export class MuscleVolume {
  @Field()
  muscle: string;

  @Field(() => Int)
  sets: number;

  @Field(() => Float)
  volume: number;
}

@ObjectType()
export class VolumeWeeklyEntry {
  @Field()
  weekKey: string;

  @Field(() => [ExerciseVolume])
  exercises: ExerciseVolume[];

  @Field(() => [MuscleVolume])
  muscles: MuscleVolume[];
}