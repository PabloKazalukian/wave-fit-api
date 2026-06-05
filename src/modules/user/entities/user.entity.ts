import { Field, ObjectType, ID, registerEnumType } from '@nestjs/graphql';
import { UserRole } from '../schema/user.schema';

registerEnumType(UserRole, {
  name: 'UserRole',
  description: 'User role enum',
});

@ObjectType()
export class Avatar {
  @Field()
  storageKey: string;

  @Field()
  url: string;

  @Field()
  source: string;
}

@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  email: string;

  password: string;

  @Field(() => UserRole)
  role: UserRole;

  @Field({ nullable: true })
  googleId?: string;

  @Field({ nullable: true })
  picture?: string;

  @Field(() => Avatar, { nullable: true })
  avatar?: Avatar;

  @Field({ nullable: true })
  timezone?: string;
}
