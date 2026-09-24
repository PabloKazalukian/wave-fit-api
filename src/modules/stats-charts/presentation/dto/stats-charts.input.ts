import { InputType, Field } from '@nestjs/graphql';
import { IsString } from 'class-validator';

@InputType()
export class StatsChartsInput {
  @Field()
  @IsString()
  from: string;

  @Field()
  @IsString()
  to: string;

  @Field({ nullable: true })
  @IsString()
  timezone?: string;
}