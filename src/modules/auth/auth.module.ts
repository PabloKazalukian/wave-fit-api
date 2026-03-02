import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UserModule } from '../user/user.module';
import { JwtStrategy } from './jwt.strategy';
import { AuthResolver } from './auth.resolver';
import { LocalStrategy } from './local.strategy';
import { GoogleModule } from './google/google.module';

@Module({
  imports: [
    UserModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'supersecretkey',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  providers: [AuthService, JwtStrategy, LocalStrategy, AuthResolver],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
