import { Resolver, Mutation, Args, Context } from '@nestjs/graphql';
import { GoogleService } from './google.service';
import { Google } from './entities/google.entity';
import { UserService } from '../../../modules/user/user.service';
import { JwtService } from '@nestjs/jwt';
import { UserGoogle } from '../../../common/interfaces/user.interface';
import { GoogleLoginOutput } from './dto/google-login.output';
import { StorageService } from '../../../modules/storage/storage.service';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

@Resolver(() => Google)
export class GoogleResolver {
  constructor(
    private readonly googleService: GoogleService,
    private userService: UserService,
    private jwtService: JwtService,
    private storageService: StorageService,
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

    const { buffer: avatarBuffer, contentType } =
      await this.googleService.getAvatarGoogle(userInfo.picture);

    let user = await this.userService.findByEmail(userInfo.email);

    if (!user) {
      user = await this.userService.createGoogleUser(userInfo);
    }

    const needsAvatar = !user.avatar || !user.avatar.storageKey;

    if (needsAvatar) {
      const ext = MIME_TO_EXT[contentType] || 'jpg';
      const key = `avatars/${user._id}/google-${Date.now()}.${ext}`;

      const url = await this.storageService.uploadFile(
        key,
        avatarBuffer,
        contentType,
      );

      user = await this.userService.updateAvatar(user._id.toString(), {
        storageKey: key,
        url,
        source: 'google',
      });
    }

    if (!user) {
      throw new Error('User not found after creation');
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
      access_token,
      user,
    };
  }
}
