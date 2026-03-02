import { Module } from '@nestjs/common';
import { GoogleService } from './google.service';
import { GoogleResolver } from './google.resolver';
import { UserModule } from 'src/modules/user/user.module';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { GoogleStrategy } from './google.strategy';
import { GoogleTokenStrategy } from './google-token.strategy';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth.module';

@Module({
  providers: [
    GoogleResolver,
    GoogleService,
    GoogleStrategy,
    GoogleTokenStrategy,
  ],
  imports: [
    UserModule,
    PassportModule,
    AuthModule, // <-- agregás esto
  ],
  exports: [GoogleService],
})
export class GoogleModule {}
