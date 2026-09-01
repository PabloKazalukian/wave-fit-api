import { ObjectType, Field } from '@nestjs/graphql';
import { DayLog } from './presentation/entities/day-log.entity';

@ObjectType()
export class ActiveDayLogResponse {
  @Field(() => Boolean)
  hasActiveDay: boolean;

  @Field(() => DayLog, { nullable: true })
  day?: DayLog;
}
