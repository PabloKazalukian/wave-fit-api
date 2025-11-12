import { Module } from '@nestjs/common';
import { ExtraSessionService } from './extra-session.service';
import { ExtraSessionResolver } from './extra-session.resolver';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ExtraSession,
  ExtraSessionSchema,
} from './schema/extra-session.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ExtraSession.name, schema: ExtraSessionSchema },
    ]),
  ],
  providers: [ExtraSessionResolver, ExtraSessionService],
})
export class ExtraSessionModule {}
