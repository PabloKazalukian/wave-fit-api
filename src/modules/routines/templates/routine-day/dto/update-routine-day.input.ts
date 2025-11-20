import { ExerciseCategory } from 'src/common/interfaces/exercise.interface';
import { CreateRoutineDayInput } from './create-routine-day.input';
import { InputType, Field, Int, PartialType } from '@nestjs/graphql';

@InputType()
export class UpdateRoutineDayInput extends PartialType(CreateRoutineDayInput) {
  @Field(() => Int)
  id: number;
}

@InputType()
export class findByCategoryInput extends PartialType(CreateRoutineDayInput) {
  @Field(() => ExerciseCategory)
  category: ExerciseCategory;
}
