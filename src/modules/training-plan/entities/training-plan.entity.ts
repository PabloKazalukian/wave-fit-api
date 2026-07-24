import { ObjectType, Field, ID, Int, Float, GraphQLISODateTime, registerEnumType } from '@nestjs/graphql';
import { PlanStatus, PlanFocus } from '../schema/training-plan.schema';
import { AiSnapshotEntity } from './ai-snapshot.entity';

registerEnumType(PlanStatus, { name: 'PlanStatus' });
registerEnumType(PlanFocus, { name: 'PlanFocus' });

@ObjectType()
export class TrainingPlan {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  userId: string;

  @Field(() => ID)
  userProfileId: string;

  @Field(() => ID)
  goalId: string;

  @Field()
  title: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => PlanFocus)
  focus: PlanFocus;

  @Field(() => PlanStatus)
  status: PlanStatus;

  @Field(() => GraphQLISODateTime)
  startDate: Date;

  @Field(() => GraphQLISODateTime)
  endDate: Date;

  @Field(() => Int)
  durationWeeks: number;

  @Field(() => Int)
  trainingDaysPerWeek: number;

  @Field(() => AiSnapshotEntity)
  aiSnapshot: AiSnapshotEntity;

  @Field(() => Float)
  overallAdherencePercent: number;

  @Field(() => Int)
  totalSessionsCompleted: number;

  @Field(() => Int)
  totalSessionsPlanned: number;

  @Field(() => ID, { nullable: true })
  replacedByPlanId?: string;

  @Field(() => Int)
  version: number;

  @Field(() => [String])
  tags: string[];

  @Field()
  confirmed: boolean;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt: Date;
}
