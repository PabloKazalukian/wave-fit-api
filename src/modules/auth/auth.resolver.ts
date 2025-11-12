// auth.resolver.ts
import { Resolver, Mutation, Args, Context, Query } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { UnauthorizedException, UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from './guards/gql-auth.guard';
import { User } from '../user/entities/user.entity';

@Resolver()
export class AuthResolver {
  constructor(private authService: AuthService) {}

  @Mutation(() => String)
  async login(
    @Args('identifier') identifier: string,
    @Args('password') password: string,
  ) {
    const user = await this.authService.validateUser(identifier, password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    // throw new Error('Invalid credentials');

    const token = await this.authService.login(user);
    return token.access_token;
  }

  @Query(() => User)
  @UseGuards(GqlAuthGuard)
  async me(@Context() context) {
    return context.req.user; // viene del JwtStrategy.validate()
  }
}
