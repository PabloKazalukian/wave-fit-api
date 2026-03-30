import { CreateExtraSessionInput } from './create-extra-session.input';
import { InputType, Field, PartialType } from '@nestjs/graphql';
import { IsString, IsMongoId } from 'class-validator';

@InputType()
export class UpdateExtraSessionInput extends PartialType(
  CreateExtraSessionInput,
) {
  @Field()
  @IsString()
  @IsMongoId()
  id: string;
}
