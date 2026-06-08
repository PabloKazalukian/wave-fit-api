import { CreateUserProfileInput } from './create-user-profile.input';
import { InputType, Field, PartialType } from '@nestjs/graphql';
import { IsMongoId, IsOptional } from 'class-validator';

@InputType()
export class UpdateUserProfileInput extends PartialType(CreateUserProfileInput) {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsMongoId()
  id?: string;
}
