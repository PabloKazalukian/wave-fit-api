import { InputType, Int, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { CreateRoutineDayInput } from 'src/routine-day/dto/create-routine-day.input';
import { RoutineDay } from 'src/routine-day/entities/routine-day.entity';

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
  @IsOptional()
  weekly_distribution: string;

  @Field(() => [CreateRoutineDayInput], { nullable: 'itemsAndList' })
  routineDays?: CreateRoutineDayInput[];

  @Field({ nullable: true })
  @IsOptional()
  createdBy?: string;
}
