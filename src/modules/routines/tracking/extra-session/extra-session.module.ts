import { Module } from '@nestjs/common';
import { ExtraSessionService } from './extra-session.service';
import { ExtraSessionResolver } from './extra-session.resolver';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ExtraSession,
  ExtraSessionSchema,
} from './schema/extra-session.schema';
import {
  WorkoutSession,
  WorkoutSessionSchema,
} from '../workout-session/schema/workout-session.schema';
import { AuditLogsModule } from 'src/modules/audit-logs/audit-logs.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ExtraSession.name, schema: ExtraSessionSchema },
      { name: WorkoutSession.name, schema: WorkoutSessionSchema },
    ]),
    AuditLogsModule,
  ],
  providers: [ExtraSessionResolver, ExtraSessionService],
  exports: [ExtraSessionService],
})
export class ExtraSessionModule {}
