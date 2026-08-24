import { ObjectType, Field, Int } from '@nestjs/graphql';
import {
  Exercise,
  ExerciseCategory,
} from '../../exercise/entities/exercise.entity';

@ObjectType()
export class RoutineDay {
  @Field(() => String)
  id: any;

  @Field()
  title: string;

  // Tipo (entrenamiento, descanso, cardio)
  @Field(() => [ExerciseCategory], { nullable: true })
  type?: ExerciseCategory[];

  // Ejercicios del día
  @Field(() => [RoutineDayExercise])
  exercises: RoutineDayExercise[];

  @Field(() => Int)
  order: number;

  // Referencia al plan al que pertenece
  @Field({ nullable: true })
  planId?: string;

  // Marcado por servidor según preferencias del usuario autenticado
  @Field({ defaultValue: false })
  isFavorite?: boolean;
}

@ObjectType()
export class RoutineDayExercise {
  @Field(() => Exercise)
  exercise: Exercise;

  @Field(() => Int)
  order: number;
}
