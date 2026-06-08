import { CreateAiInput } from './create-ai.input';
import { InputType, Field, Int, PartialType } from '@nestjs/graphql';

@InputType()
export class UpdateAiInput extends PartialType(CreateAiInput) {
  @Field(() => Int)
  id: number;
}
