import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
// import { ExerciseCategory } from 'src/common/interfaces/exercise.interface';

export enum ExerciseCategory {
  CHEST = 'chest',
  BACK = 'back',
  LEGS = 'legs',
  LEGS_FRONT = 'legs_front',
  LEGS_POSTERIOR = 'legs_posterior',
  BICEPS = 'biceps',
  TRICEPS = 'triceps',
  SHOULDERS = 'shoulders',
  CORE = 'core',
  CARDIO = 'cardio',
  REST = 'rest',
}

registerEnumType(ExerciseCategory, {
  name: 'ExerciseCategory',
});

@ObjectType()
export class Exercise {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => ExerciseCategory)
  category: ExerciseCategory;

  @Field({ defaultValue: false })
  usesWeight: boolean;

  @Field()
  normalizedName: string;
}
