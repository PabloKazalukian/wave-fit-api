import { ExerciseCategory } from '../../exercise/entities/exercise.entity';
import { CreateRoutineDayInput } from './create-routine-day.input';
import { InputType, Field, ID, PartialType } from '@nestjs/graphql';

@InputType()
export class UpdateRoutineDayInput extends PartialType(CreateRoutineDayInput) {
  @Field(() => ID)
  id: string;
}

@InputType()
export class findByCategoryInput extends PartialType(CreateRoutineDayInput) {
  @Field(() => ExerciseCategory)
  category: ExerciseCategory;
}
