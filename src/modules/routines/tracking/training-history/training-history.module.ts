import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TrainingHistoryService } from './training-history.service';
import { TrainingHistoryResolver } from './training-history.resolver';
import {
  WeekLog,
  WeekLogSchema,
} from '../week-log/infrastructure/schemas/week-log.schema';
import {
  WorkoutSession,
  WorkoutSessionSchema,
} from '../workout-session/schema/workout-session.schema';
import {
  ExtraSession,
  ExtraSessionSchema,
} from '../extra-session/schema/extra-session.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WeekLog.name, schema: WeekLogSchema },
      { name: WorkoutSession.name, schema: WorkoutSessionSchema },
      { name: ExtraSession.name, schema: ExtraSessionSchema },
    ]),
  ],
  providers: [TrainingHistoryResolver, TrainingHistoryService],
  exports: [TrainingHistoryService],
})
export class TrainingHistoryModule {}
