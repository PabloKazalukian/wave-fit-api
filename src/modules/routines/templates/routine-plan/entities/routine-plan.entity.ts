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

  @Field({ nullable: true })
  weekly_distribution?: string;

  @Field({ defaultValue: false })
  isFavorite?: boolean;

  @Field(() => [RoutineDay], { nullable: 'itemsAndList' })
  routineDays?: RoutineDay[];

  @Field({ nullable: true })
  createdBy?: string;

  // true = plan generado con IA (el front muestra "Plan generado con IA")
  @Field({ defaultValue: false })
  isAiGenerated?: boolean;

  @Field(() => ID, { nullable: true })
  generatedFromPlanId?: string;

  // Propiedad interna para el resolver, no expuesta en GraphQL directamente
  week?: {
    day?: string;
    isRest: boolean;
    order: number;
  }[];
}
