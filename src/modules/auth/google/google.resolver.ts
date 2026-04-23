import { Resolver, Mutation, Args, Context } from '@nestjs/graphql';
import { GoogleService } from './google.service';
import { Google } from './entities/google.entity';
import { UserService } from '../../../modules/user/user.service';
import { JwtService } from '@nestjs/jwt';
import { UserGoogle } from '../../../common/interfaces/user.interface';
import { GoogleLoginOutput } from './dto/google-login.output';

@Resolver(() => Google)
export class GoogleResolver {
  constructor(
    private readonly googleService: GoogleService,
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  @Mutation(() => GoogleLoginOutput)
  async loginWithGoogle(
    @Args('code') code: string,
    @Args('codeVerifier') codeVerifier: string,
    @Context() context: any,
  ) {
    if (code == null || codeVerifier == null) {
      throw new Error('Code or Code Verifier is null');
    }
    const tokens: any = await this.googleService.getTokens(code, codeVerifier);

    const userInfo: UserGoogle = await this.googleService.getUserInfo(
      tokens.id_token,
    );

    let user = await this.userService.findByEmail(userInfo.email);

    if (!user) {
      user = await this.userService.createGoogleUser(userInfo);
    }

    const payload = { sub: user._id, email: user.email, role: user.role };
    const access_token = this.jwtService.sign(payload);

    context.res.cookie('token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      partitioned: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    });

    return {
      access_token, // Keeping it for compatibility with the DTO for now, but the important part is the cookie
      user,
    };
  }
}
