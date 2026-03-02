import { Field, ObjectType } from '@nestjs/graphql';
import { User } from '../../../../modules/user/entities/user.entity';

@ObjectType()
export class GoogleLoginOutput {
  @Field()
  access_token: string;

  @Field(() => User)
  user: User;
}
