import { CreateDayLogInput } from './create-day-log.input';
import { InputType, Field, Int, PartialType } from '@nestjs/graphql';

@InputType()
export class UpdateDayLogInput extends PartialType(CreateDayLogInput) {
  @Field(() => Int)
  id: number;
}
