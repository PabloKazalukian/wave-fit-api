import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

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

  @Field(() => [String], { nullable: 'itemsAndList' })
  routineDays?: (string | null)[];

  @Field({ nullable: true })
  @IsOptional()
  createdBy?: string;
}

@InputType()
export class ValidateTitleInput {
  @Field()
  title: string;
}
