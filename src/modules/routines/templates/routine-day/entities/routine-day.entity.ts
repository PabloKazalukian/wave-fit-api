import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Exercise } from '../../exercise/entities/exercise.entity';

@ObjectType()
export class RoutineDay {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  // Tipo (entrenamiento, descanso, cardio)
  @Field({ nullable: true })
  type?: string;

  // Ejercicios del día
  @Field(() => [Exercise], { nullable: 'itemsAndList' })
  exercises?: Exercise[];

  // Referencia al plan al que pertenece
  @Field({ nullable: true })
  planId?: string;
}
