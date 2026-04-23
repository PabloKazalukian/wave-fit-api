// auth.resolver.ts
import { Resolver, Mutation, Args, Context, Query } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { UnauthorizedException, UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from './guards/gql-auth.guard';
import { User } from '../user/entities/user.entity';

@Resolver()
export class AuthResolver {
  constructor(private authService: AuthService) {}

  @Mutation(() => Boolean)
  async login(
    @Args('identifier') identifier: string,
    @Args('password') password: string,
    @Context() context: any,
  ) {
    const user = await this.authService.validateUser(identifier, password);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const { access_token } = await this.authService.login(user);

    context.res.cookie('token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      partitioned: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    });

    return true;
  }

  @Query(() => User)
  @UseGuards(GqlAuthGuard)
  async me(@Context() context) {
    return context.req.user; // viene del JwtStrategy.validate()
  }

  @Mutation(() => Boolean)
  async logout(@Context() context: any) {
    context.res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      partitioned: process.env.NODE_ENV === 'production',
    });
    return true;
  }
}
