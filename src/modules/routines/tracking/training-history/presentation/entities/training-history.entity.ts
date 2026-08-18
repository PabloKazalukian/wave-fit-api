import { ObjectType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';

export enum DayType {
  WEEK_LOG = 'WEEK_LOG',
  DAY_LOG = 'DAY_LOG',
}

export enum TrainingStatus {
  PENDING = 'pending',
  COMPLETE = 'complete',
  SKIPPED = 'skipped',
  REST = 'rest',
}

registerEnumType(DayType, { name: 'DayType' });
registerEnumType(TrainingStatus, { name: 'TrainingStatus' });

@ObjectType()
export class WeekLogReference {
  @Field(() => ID)
  id: string;

  @Field()
  startDate: Date;

  @Field()
  endDate: Date;

  @Field()
  completed: boolean;

  @Field()
  active: boolean;

  @Field({ nullable: true })
  notes?: string;
}

@ObjectType()
export class CalendarDay {
  @Field()
  date: string;

  @Field(() => DayType)
  type: DayType;

  @Field(() => TrainingStatus)
  status: TrainingStatus;

  @Field(() => ID, { nullable: true })
  workoutSessionId?: string;

  @Field(() => [ID], { nullable: true })
  extraSessionIds?: string[];

  @Field(() => WeekLogReference, { nullable: true })
  weekLogReference?: WeekLogReference;
}

@ObjectType()
export class TrainingCalendarResponse {
  @Field(() => Int)
  year: number;

  @Field(() => Int)
  month: number;

  @Field(() => [CalendarDay])
  days: CalendarDay[];
}
