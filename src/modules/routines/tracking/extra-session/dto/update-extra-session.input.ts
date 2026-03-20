import { CreateExtraSessionInput } from './create-extra-session.input';
import { InputType, Field, Int, PartialType } from '@nestjs/graphql';

@InputType()
export class UpdateExtraSessionInput extends PartialType(
  CreateExtraSessionInput,
) {
  @Field(() => Int)
  id: number;
}
