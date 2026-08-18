import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class TrainingCalendarInput {
  @Field(() => Int)
  year: number;

  @Field(() => Int)
  month: number;

  @Field({ nullable: true })
  timezone?: string;
}
