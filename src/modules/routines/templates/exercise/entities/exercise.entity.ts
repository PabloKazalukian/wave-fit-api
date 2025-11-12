import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { ExerciseCategory } from 'src/common/interfaces/exercise.interface';

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

  // Si requiere peso (true = barra/mancuerna, false = peso corporal)
  @Field({ defaultValue: false })
  usesWeight: boolean;
}
