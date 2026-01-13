import { InputType, Int, Field, ID } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { CreateRoutineDayInput } from '../../routine-day/dto/create-routine-day.input';

@InputType()
export class CreateRoutinePlanInput {
  @Field(() => String)
  @IsNotEmpty()
  name: string;

  @Field()
  @IsNotEmpty()
  @MaxLength(150)
  description: string;

  @Field()
  weekly_distribution: string;

  // @Field(() => [CreateRoutineDayInput], { nullable: 'itemsAndList' })
  // routineDays?: CreateRoutineDayInput[];

  @Field(() => [ID], { nullable: 'itemsAndList' })
  routineDays?: string[];

  @Field({ nullable: true })
  @IsOptional()
  createdBy?: string;
}
