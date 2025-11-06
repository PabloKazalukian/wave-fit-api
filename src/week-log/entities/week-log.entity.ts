import { ObjectType, Field, ID } from '@nestjs/graphql';
import { ExtraSession } from 'src/extra-session/entities/extra-session.entity';
import { WorkoutSession } from 'src/workout-session/entities/workout-session.entity';

@ObjectType()
export class WeekLog {
  @Field(() => ID)
  id: string;

  @Field()
  userId: string;

  @Field()
  startDate: Date;

  @Field()
  endDate: Date;

  // Array de 7 días: si un día está vacío, se asume descanso
  @Field(() => [WorkoutSession], { nullable: 'itemsAndList' })
  workouts?: WorkoutSession[];

  // Extras fuera del plan
  @Field(() => [ExtraSession], { nullable: 'itemsAndList' })
  extras?: ExtraSession[];

  @Field({ nullable: true })
  planId?: string; // plan elegido esa semana

  @Field({ nullable: true })
  notes?: string;
}
