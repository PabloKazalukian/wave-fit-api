import { ObjectType, Field, ID } from '@nestjs/graphql';
import { RoutineDay } from '../../routine-day/entities/routine-day.entity';

@ObjectType()
export class RoutinePlan {
  @Field(() => ID)
  id: string;

  @Field({ nullable: false })
  name: string;

  @Field({ nullable: false })
  description: string;

  // exemple: "6/7 4/7"
  @Field({ nullable: true })
  weekly_distribution?: string;

  @Field(() => [RoutineDay], { nullable: 'itemsAndList' })
  routineDays?: RoutineDay[];

  @Field({ nullable: true })
  createdBy?: string;
}
