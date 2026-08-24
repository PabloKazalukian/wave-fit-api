import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class TrainingPreference {
  @Field(() => ID)
  _id: string;

  @Field(() => ID)
  userId: string;

  @Field(() => [String])
  preferredStyles: string[];

  @Field(() => [String])
  dislikedExercises: string[];

  @Field(() => [ID])
  favoriteExercises: string[];

  @Field(() => [ID])
  favoriteRoutines: string[];

  @Field(() => [ID])
  favoriteRoutineDays: string[];

  @Field()
  cardioPreference: string;

  @Field()
  intensityPreference: string;

  @Field({ nullable: true })
  workoutVibe?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
