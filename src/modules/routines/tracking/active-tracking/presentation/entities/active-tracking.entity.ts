import { ObjectType, Field } from '@nestjs/graphql';
import { registerEnumType } from '@nestjs/graphql';
import { WeekLog } from '../../../week-log/presentation/entities/week-log.entity';
import { DayLog } from '../../../day-log/presentation/entities/day-log.entity';

export enum TrackingType {
  WEEK_LOG = 'WEEK_LOG',
  DAY_LOG = 'DAY_LOG',
}

registerEnumType(TrackingType, {
  name: 'TrackingType',
  description: 'Tipo de tracking activo',
});

@ObjectType()
export class ActiveTracking {
  @Field(() => Boolean)
  hasActive: boolean;

  @Field(() => TrackingType, { nullable: true })
  type?: TrackingType;

  @Field(() => WeekLog, { nullable: true })
  week?: WeekLog;

  @Field(() => DayLog, { nullable: true })
  day?: DayLog;
}
