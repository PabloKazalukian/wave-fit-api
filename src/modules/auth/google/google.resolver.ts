import { Resolver, Mutation, Args } from '@nestjs/graphql';
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
    // const jwt = this.jwtService.sign(payload);
    return {
      access_token: this.jwtService.sign(payload),
    };

    // return payload;
  }
}
