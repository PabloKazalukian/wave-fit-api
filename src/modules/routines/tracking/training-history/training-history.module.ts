import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TrainingHistoryService } from './training-history.service';
import { TrainingHistoryResolver } from './training-history.resolver';
import {
  WeekLog,
  WeekLogSchema,
} from '../week-log/infrastructure/schemas/week-log.schema';
import { DayLog, DayLogSchema } from '../day-log/infrastructure/schemas/day-log.schema';
import {
  ExtraSession,
  ExtraSessionSchema,
} from '../extra-session/schema/extra-session.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WeekLog.name, schema: WeekLogSchema },
      { name: DayLog.name, schema: DayLogSchema },
      { name: ExtraSession.name, schema: ExtraSessionSchema },
    ]),
  ],
  providers: [TrainingHistoryResolver, TrainingHistoryService],
  exports: [TrainingHistoryService],
})
export class TrainingHistoryModule {}