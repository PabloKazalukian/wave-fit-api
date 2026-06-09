import { InputType, Field } from '@nestjs/graphql';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsIn,
  Min,
  Max,
  ArrayMaxSize,
} from 'class-validator';

const PREFERRED_TIME_VALUES = [
  'morning', 'noon', 'afternoon', 'evening',
] as const;

const REST_DAY_ACTIVITY_VALUES = [
  'full_rest', 'light_walk', 'active_recovery', 'yoga_stretching',
] as const;

@InputType()
export class UpdateScheduleInput {
  @Field()
  @IsNumber()
  @Min(1)
  @Max(7)
  daysPerWeek: number;

  @Field(() => [Number], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  preferredDays?: number[];

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(15)
  @Max(240)
  sessionDurationMin?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsIn(PREFERRED_TIME_VALUES)
  preferredTime?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsIn(REST_DAY_ACTIVITY_VALUES)
  restDayActivity?: string;
}
