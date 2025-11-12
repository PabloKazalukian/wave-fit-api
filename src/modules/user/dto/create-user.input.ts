import { InputType, Int, Field } from '@nestjs/graphql';
import { IsEmail, isEnum, MinLength } from 'class-validator';
import { UserRole } from '../schema/user.schema';

@InputType()
export class CreateUserInput {
  @Field(() => String)
  name: string;

  @Field()
  @IsEmail()
  email: string;

  @Field()
  @MinLength(6)
  password: string;

  @Field(() => String, { defaultValue: UserRole.USER })
  role: UserRole = UserRole.USER;
}
