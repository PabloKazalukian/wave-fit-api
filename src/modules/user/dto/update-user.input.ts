import { InputType, Field } from '@nestjs/graphql';
import { IsOptional, IsString } from 'class-validator';
import { CreateUserInput } from './create-user.input';
import { PartialType } from '@nestjs/graphql';

@InputType()
export class UpdateUserInput extends PartialType(CreateUserInput) {
  @Field(() => String)
  id: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  timezone?: string;
}
