import { CreateGoogleInput } from './create-google.input';
import { InputType, Field, Int, PartialType } from '@nestjs/graphql';

@InputType()
export class UpdateGoogleInput extends PartialType(CreateGoogleInput) {
  @Field(() => Int)
  id: number;
}
