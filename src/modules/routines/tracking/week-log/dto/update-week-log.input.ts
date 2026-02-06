import { CreateWeekLogInput } from './create-week-log.input';
import { InputType, Field, Int, PartialType } from '@nestjs/graphql';

@InputType()
export class UpdateWeekLogInput extends PartialType(CreateWeekLogInput) {
  @Field(() => String)
  id: string;
}
