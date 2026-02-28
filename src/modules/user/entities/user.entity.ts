import { Field, ObjectType, ID } from '@nestjs/graphql';
import { UserRole } from '../schema/user.schema';

@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  email: string;

  @Field()
  password: string;

  @Field()
  role: UserRole;
}
