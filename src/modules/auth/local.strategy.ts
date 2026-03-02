// local.strategy.ts
import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private authService: AuthService) {
    super({ usernameField: 'identifier' }); // puede ser name o email
  }

  async validate(identifier: string, password: string): Promise<any> {
    const user = await this.authService.validateUser(identifier, password);
    console.log('user', user);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    return user;
  }
}
