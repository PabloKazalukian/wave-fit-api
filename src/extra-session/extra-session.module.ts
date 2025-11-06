import { Module } from '@nestjs/common';
import { ExtraSessionService } from './extra-session.service';
import { ExtraSessionResolver } from './extra-session.resolver';

@Module({
  providers: [ExtraSessionResolver, ExtraSessionService],
})
export class ExtraSessionModule {}
