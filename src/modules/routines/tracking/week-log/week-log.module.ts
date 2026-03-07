import { Module } from '@nestjs/common';
import { WeekLogService } from './week-log.service';
import { WeekLogResolver } from './week-log.resolver';
import { MongooseModule } from '@nestjs/mongoose';
import { WeekLog, WeekLogSchema } from './schema/week-log.schema';
import { WeekLogValidator } from './week-log.validator';
import {
  WorkoutSession,
  WorkoutSessionSchema,
} from '../workout-session/schema/workout-session.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WeekLog.name, schema: WeekLogSchema },
      { name: WorkoutSession.name, schema: WorkoutSessionSchema },
    ]),
  ],
  providers: [WeekLogResolver, WeekLogService, WeekLogValidator],
  exports: [WeekLogService],
})
export class WeekLogModule {}
