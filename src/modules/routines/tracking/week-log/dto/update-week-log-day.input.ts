import { InputType, Field, ID, Int } from '@nestjs/graphql';
import { IsMongoId, IsOptional, IsString } from 'class-validator';

@InputType()
export class UpdateWeekLogDayInput {
  @Field(() => ID)
  @IsMongoId()
  weekLogId: string;

  @Field(() => Int)
  order: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  status?: 'pending' | 'complete' | 'skipped';
}
