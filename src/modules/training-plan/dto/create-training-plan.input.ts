import { InputType, Field, Int } from '@nestjs/graphql';
import { IsEnum } from 'class-validator';
import { PlanFocus } from '../schema/training-plan.schema';

@InputType()
export class CreateTrainingPlanInput {
  @Field()
  title: string;

  @Field({ nullable: true })
  description?: string;

  // Mismo enum que el schema; valores alineados con PrimaryGoal del perfil
  @Field(() => PlanFocus)
  @IsEnum(PlanFocus)
  focus: PlanFocus;

  @Field(() => Int)
  durationWeeks: number;

  @Field(() => Int)
  trainingDaysPerWeek: number;

  @Field({ nullable: true })
  startDate?: string;

  @Field(() => [String], { nullable: true })
  tags?: string[];
}
