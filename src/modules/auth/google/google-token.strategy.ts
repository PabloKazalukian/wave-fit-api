// google-token.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { GoogleService } from './google.service';
import { UserService } from '../../user/user.service';

@Injectable()
export class GoogleTokenStrategy extends PassportStrategy(
  Strategy,
  'google-token',
) {
  constructor(
    private googleService: GoogleService,
    private userService: UserService,
  ) {
    super();
  }

  async validate(req: any): Promise<any> {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedException('No authorization header');
    }

    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid token format');
    }

    try {
      // Intentar decodificar sin verificar para ver si parece un token de Google
      // Los tokens de Google son JWTs que suelen tener el issuer accounts.google.com
      // Como simplificación, si no es nuestro JWT (porque JwtStrategy falló),
      // intentamos validar con Google.

      const userInfo = await this.googleService.getUserInfo(token);
      let user = await this.userService.findByEmail(userInfo.email);

      if (!user) {
        user = await this.userService.createGoogleUser(userInfo);
      }

      return user;
    } catch {
      // Si falla la validación con Google, simplemente retornamos false
      // para que Passport pruebe la siguiente estrategia o falle el Guard.
      // Así no sobreescribimos errores útiles como "Token Expired".
      return null;
    }
  }
}
