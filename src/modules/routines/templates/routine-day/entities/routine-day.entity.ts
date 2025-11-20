import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Exercise } from '../../exercise/entities/exercise.entity';
import { ExerciseCategory } from 'src/common/interfaces/exercise.interface';
import { IsOptional } from 'class-validator';

@ObjectType()
export class RoutineDay {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  // Tipo (entrenamiento, descanso, cardio)
  @Field(() => [ExerciseCategory], { nullable: true })
  type?: ExerciseCategory[];

  // Ejercicios del día
  @Field(() => [Exercise], { nullable: 'itemsAndList' })
  exercises?: Exercise[];

  // Referencia al plan al que pertenece
  @Field({ nullable: true })
  planId?: string;
}
