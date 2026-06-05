import { Module } from '@nestjs/common';
import { GoogleService } from './google.service';
import { GoogleResolver } from './google.resolver';
import { UserModule } from 'src/modules/user/user.module';
import { GoogleStrategy } from './google.strategy';
import { GoogleTokenStrategy } from './google-token.strategy';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth.module';
import { StorageService } from 'src/modules/storage/storage.service';
import { StorageModule } from 'src/modules/storage/storage.module';

@Module({
  providers: [
    GoogleResolver,
    GoogleService,
    GoogleStrategy,
    GoogleTokenStrategy,
    StorageService,
  ],
  imports: [UserModule, PassportModule, StorageModule, AuthModule],
  exports: [GoogleService],
})
export class GoogleModule {}
