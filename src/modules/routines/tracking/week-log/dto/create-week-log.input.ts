import { InputType, Field, ID } from '@nestjs/graphql';
import { IsDate, IsOptional, IsString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

@InputType()
export class CreateWeekLogInput {
  @Field(() => Date)
  @IsDate()
  @Type(() => Date)
  startDate: Date;

  @Field(() => Date)
  @IsDate()
  @Type(() => Date)
  endDate: Date;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  planId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;

  @Field({ nullable: true, defaultValue: false })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
